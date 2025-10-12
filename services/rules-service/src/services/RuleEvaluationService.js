import Rule from '../models/Rule.js';
import mongoose from 'mongoose';
import { Kafka } from 'kafkajs';
import RulePriorityService from './RulePriorityService.js';

class RuleEvaluationService {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'rules-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
    this.producer = this.kafka.producer();
    this.producerConnected = false;
    
    this.priorityService = new RulePriorityService();
  }

  // Đánh giá tất cả rules cho một device khi nhận dữ liệu sensor
  async evaluateRules(deviceId, sensorData, ownerId = null) {
    try {
      console.log(`🔍 Evaluating rules for device: ${deviceId}`);

      // 🔎 1. Lấy danh sách rule đang hoạt động
      const query = { deviceId, isActive: true };
      if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) query.ownerId = new mongoose.Types.ObjectId(ownerId);
      const rules = await Rule.find(query);
      console.log(`📋 Found ${rules.length} active rules for device ${deviceId}`);
      if (!rules.length) return;
  
      // ⚙️ 2. Đánh giá tất cả rule
      const triggeredRules = await Promise.all(
        rules.map(async rule => {
          try {
            return (await this.evaluateRule(rule, sensorData)) ? rule : null;
          } catch (err) {
            console.error(`❌ Rule error [${rule.name}]:`, err);
            return null;
          }
        })
      ).then(results => results.filter(Boolean));
  
      // 📢 3. Xử lý kết quả theo priority
      if (triggeredRules.length > 1) {
        console.log(`🔄 Multiple rules triggered (${triggeredRules.length}) - Processing by priority`);
        
        // Sắp xếp theo priority: urgent → high → medium → low
        const sortedRules = this.priorityService.sortByPriority(triggeredRules);
        console.log(`📊 Priority order: ${sortedRules.map(r => `${r.name}(${r.priority})`).join(' → ')}`);
        
        // Tạo consolidated notification
        const incident = this.priorityService.createIncidentReport(sortedRules, { ...sensorData, deviceId });
        const consolidatedMessage = this.priorityService.buildConsolidatedNotification(incident, ownerId);
        
        await this.sendToAlertsService(consolidatedMessage);
        console.log(`📤 Consolidated alert sent (${triggeredRules.length} rules) - Priority: ${incident.severity}`);
        
      } else if (triggeredRules.length === 1) {
        console.log(`✅ Single rule triggered: ${triggeredRules[0].name} (${triggeredRules[0].priority})`);
      }
    } catch (err) {
      console.error(`❌ evaluateRules() error for device ${deviceId}:`, err);
    }
  }  

  // Đánh giá một rule cụ thể
  async evaluateRule(rule, sensorData) {
    try {
      const { name, _id } = rule;
      console.log(`🔍 Evaluating rule: ${name} (ID: ${_id})`);

      // Special handling for gas leak - always trigger regardless of cooldown/limits
      const isGasLeak = rule.conditions.some(condition => 
        condition.type === 'sensor' && condition.sensor === 'gas_ppm'
      );
      
      if (!isGasLeak) {
        // Check if rule can trigger (active, not paused, not in cooldown, not reached daily limit)
        if (!(await rule.canTrigger())) {
          console.log(`⏸️ Rule ${name} cannot trigger (paused/cooldown/daily limit)`);
          return false;
        }
      } else {
        console.log(`🚨 Gas leak rule - bypassing cooldown/limits for immediate alert`);
      }

      // Đánh giá tất cả conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions, sensorData);
      if (!conditionsMet) {
        console.log(`❌ Conditions not met for rule: ${name}`);
        // Reset duration tracking if conditions not met
        if (rule.duration > 0) {
          rule.resetDurationTracking();
          await rule.save();
        }
        return false;
      }

      // Check duration requirement
      if (rule.duration > 0) {
        const durationMet = rule.checkDurationMet();
        if (!durationMet) {
          console.log(`⏱️ Rule ${name} conditions met but duration not yet satisfied (${rule.duration}ms required)`);
          await rule.save(); // Save duration tracking state
          return false;
        }
        console.log(`✅ Duration requirement met for rule: ${name}`);
      }

      console.log(`✅ Conditions and duration met! Executing actions for: ${name}`);
      
      // Increment trigger count and update last triggered time (except for gas leak)
      if (!isGasLeak) {
        await rule.incrementTriggerCount();
      } else {
        console.log(`🚨 Gas leak - skipping trigger count increment for unlimited alerts`);
      }
      
      // Reset duration tracking after successful trigger
      if (rule.duration > 0) {
        rule.resetDurationTracking();
        await rule.save();
      }
      
      await this.executeActions(rule, sensorData).catch(err =>
        console.error(`❌ Action error for ${name}:`, err)
      );

      return true;
    } catch (err) {
      console.error(`❌ evaluateRule() error for ${rule.name}:`, err);
      return false;
    }
  }

  // Đánh giá tất cả conditions của rule
  async evaluateConditions(conditions, sensorData) {
    for (const condition of conditions) {
      const conditionMet = await this.evaluateCondition(condition, sensorData);
      if (!conditionMet) {
        return false;
      }
    }
    return true;
  }

  // Đánh giá một condition cụ thể
  async evaluateCondition(condition, sensorData) {
    if (condition.type === 'sensor') {
      return this.evaluateSensorCondition(condition, sensorData);
    }
    console.warn(`⚠️ Unknown condition type: ${condition.type}`);
    return false;
  }

  // Đánh giá sensor condition
  evaluateSensorCondition(condition, sensorData) {
    const { sensor, operator, value } = condition;
    
    // Lấy giá trị sensor từ dữ liệu
    let sensorValue;
    switch (sensor) {
      case 'temperature':
        sensorValue = sensorData.temp;
        break;
      case 'humidity':
        sensorValue = sensorData.humid;
        break;
      case 'gas_ppm':
        sensorValue = sensorData.gas_ppm;
        break;
      case 'smoke':
        sensorValue = sensorData.smoke;
        break;
      default:
        console.log(`⚠️ Unknown sensor type: ${sensor}`);
        return false;
    }

    if (sensorValue === undefined || sensorValue === null) {
      console.log(`⚠️ Sensor value not available: ${sensor}`);
      return false;
    }

    // So sánh giá trị với ngưỡng
    const result = this.compareValues(sensorValue, operator, value);
    
    console.log(`🔍 Sensor condition: ${sensor} ${operator} ${value}, actual: ${sensorValue}, result: ${result}`);
    console.log(`📊 Full sensor data:`, JSON.stringify(sensorData, null, 2));
    
    return result;
  }

  /**
   * So sánh giá trị với operator
   * @param {number} actual - Giá trị thực tế
   * @param {string} operator - Toán tử so sánh
   * @param {number} expected - Giá trị mong đợi
   * @returns {boolean}
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case '>':
        return actual > expected;
      case '<':
        return actual < expected;
      case '>=':
        return actual >= expected;
      case '<=':
        return actual <= expected;
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      case 'between':
        if (Array.isArray(expected) && expected.length === 2) {
          return actual >= expected[0] && actual <= expected[1];
        }
        return false;
      default:
        console.log(`⚠️ Unknown operator: ${operator}`);
        return false;
    }
  }

  // Thực thi các actions của rule
  async executeActions(rule, sensorData) {
    try {
      console.log(`🎯 Executing ${rule.actions.length} actions for rule: ${rule.name}`);
      
      // Đảm bảo Kafka producer đã kết nối
      if (!this.producerConnected) {
        try {
          await this.producer.connect();
          this.producerConnected = true;
          console.log('✅ Kafka producer connected');
        } catch (connectError) {
          console.error(`❌ Failed to connect Kafka producer:`, connectError);
          return;
        }
      }

      for (const action of rule.actions) {
        try {
          await this.executeAction(action, rule, sensorData);
        } catch (actionError) {
          console.error(`❌ Error executing action ${action.type} for rule ${rule.name}:`, actionError);
        }
      }
    } catch (error) {
      console.error(`❌ Error executing actions for rule ${rule.name}:`, error);
    }
  }

  // Thực thi một action cụ thể
  async executeAction(action, rule, sensorData) {
    try {
      console.log(`🎯 Executing action: ${action.type} for rule: ${rule.name}`);

      switch (action.type) {
        case 'send_notification':
          await this.sendNotificationAction(action, rule, sensorData);
          break;
        case 'send_alert':
          await this.sendAlertAction(action, rule, sensorData);
          break;
        default:
          console.log(`⚠️ Unknown action type: ${action.type}`);
      }

    } catch (error) {
      console.error(`❌ Error executing action ${action.type}:`, error);
    }
  }

  // Gửi notification action
  async sendNotificationAction(action, rule, sensorData) {
    try {
      let sensorType = 'unknown';
      let sensorValue = 0;
      let threshold = 0;
      let operator = '>';
      
      // Tìm sensor condition
      for (const condition of rule.conditions) {
        if (condition.type === 'sensor' && condition.sensor) {
          sensorType = condition.sensor;
          operator = condition.operator || '>';
          threshold = condition.value || 0;
          
          switch (condition.sensor) {
            case 'temperature':
              sensorValue = sensorData.temp;
              break;
            case 'humidity':
              sensorValue = sensorData.humid;
              break;
            case 'gas_ppm':
              sensorValue = sensorData.gas_ppm;
              break;
            case 'smoke':
              sensorValue = sensorData.smoke;
              break;
          }
          break;
        }
      }
      
      let detailedMessage = action.message;
      if (!detailedMessage) {
        // Tạo message chi tiết dựa trên sensor type
        switch (sensorType) {
          case 'temperature':
            detailedMessage = `Cảm biến nhiệt độ đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}°C, Ngưỡng: ${threshold}°C`;
            break;
          case 'humidity':
            detailedMessage = `Cảm biến độ ẩm đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}%, Ngưỡng: ${threshold}%`;
            break;
          case 'gas_ppm':
            detailedMessage = `Cảm biến gas_ppm đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}, Ngưỡng: ${threshold}`;
            break;
          case 'smoke':
            detailedMessage = `Cảm biến khói đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}, Ngưỡng: ${threshold}`;
            break;
          default:
            detailedMessage = `Rule "${rule.name}" has been triggered. Sensor: ${sensorType}, Value: ${sensorValue}, Threshold: ${threshold}`;
        }
      } else {
        detailedMessage = this.replacePlaceholders(detailedMessage, sensorData, sensorType, sensorValue, threshold, operator);
      }

      // Determine risk level - Gas leak is most dangerous, smoke is less urgent
      const isGasLeak = sensorType === 'gas_ppm';
      const isSmoke = sensorType === 'smoke';
      const tempHigh = sensorType === 'temperature' && Number(sensorValue) >= 80;
      const elevateSecurity = isGasLeak || (isSmoke && Number(sensorValue) === 1) || tempHigh;

      // Tạo title với placeholder replacement
      let title = action.title;
      if (!title) {
        switch (sensorType) {
          case 'temperature':
            title = `Cảnh báo nhiệt độ`;
            break;
          case 'humidity':
            title = `Cảnh báo độ ẩm`;
            break;
          case 'gas_ppm':
            title = `Cảnh báo khí gas`;
            break;
          case 'smoke':
            title = `Cảnh báo khói`;
            break;
          default:
            title = `Cảnh báo ${sensorType}`;
        }
      }
      title = this.replacePlaceholders(title, sensorData, sensorType, sensorValue, threshold, operator);
      if (!rule.ownerId) {
        console.error(`❌ Rule ${rule.name} has no ownerId, skipping notification`);
        return;
      }

      const message = {
        userId: rule.ownerId.toString(),
        title: title,
        message: detailedMessage,
        type: elevateSecurity ? 'security_alert' : 'device_alert',
        category: elevateSecurity ? 'security' : 'rule',
        priority: elevateSecurity ? 'urgent' : (rule.priority || 'medium'),
        metadata: {
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          deviceId: rule.deviceId,
          sensorData: sensorData,
          actionType: action.type,
          sensorType: sensorType,
          sensorValue: sensorValue,
          threshold: threshold,
          operator: operator
        }
      };

      try {
        const result = await this.producer.send({
          topic: 'notification-requests',
          messages: [{
            key: rule.ownerId.toString(),
            value: JSON.stringify(message)
          }]
        });

        console.log(`✅ Notification sent for rule: ${rule.name}`);
      } catch (kafkaError) {
        console.error(`❌ Kafka send error for rule ${rule.name}:`, kafkaError);
      }
    } catch (error) {
      console.error(`❌ Error sending notification for rule ${rule.name}:`, error);
    }
  }

  // Gửi alert action
  async sendAlertAction(action, rule, sensorData) {
    let sensorType = 'unknown';
    let sensorValue = 0;
    let threshold = 0;
    
    // Find sensor condition
    for (const condition of rule.conditions) {
      if (condition.type === 'sensor' && condition.sensor) {
        sensorType = condition.sensor;
        threshold = condition.value || 0;
        
        switch (condition.sensor) {
          case 'temperature':
            sensorValue = sensorData.temp;
            break;
          case 'humidity':
            sensorValue = sensorData.humid;
            break;
          case 'gas_ppm':
            sensorValue = sensorData.gas_ppm;
            break;
          case 'smoke':
            sensorValue = sensorData.smoke;
            break;
        }
        break;
      }
    }
    const isGasLeak = sensorType === 'gas_ppm';
    const isSmoke = sensorType === 'smoke';
    const tempHigh = sensorType === 'temperature' && Number(sensorValue) >= 80;
    const elevateSecurity = isGasLeak || (isSmoke && Number(sensorValue) === 1) || tempHigh;

    // Validate required fields
    if (!rule.ownerId) {
      console.error(`❌ Rule ${rule.name} has no ownerId, skipping alert`);
      return;
    }

    const message = {
      deviceId: rule.deviceId,
      deviceName: `Device ${rule.deviceId}`,
      sensorType,
      sensorValue,
      threshold,
      alertType: 'threshold_exceeded',
      category: elevateSecurity ? 'security' : 'sensor',
      priority: elevateSecurity ? 'urgent' : (rule.priority || 'medium'),
      userId: rule.ownerId.toString(),
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      message: action.message || `Alert: ${rule.name} triggered`
    };

    try {
      await this.producer.send({
        topic: 'device-alerts',
        messages: [{
          key: rule.deviceId,
          value: JSON.stringify(message)
        }]
      });

      console.log(`🚨 Alert sent for rule: ${rule.name}`);
    } catch (kafkaError) {
      console.error(`❌ Kafka alert send error for rule ${rule.name}:`, kafkaError);
    }
  }

  // Gửi message đến alerts-service qua Kafka
  async sendToAlertsService(message) {
    try {
      if (!this.producerConnected) {
        await this.producer.connect();
        this.producerConnected = true;
        console.log('✅ Kafka producer connected');
      }

      await this.producer.send({
        topic: 'notification-requests',
        messages: [{ key: message.userId || 'rules-service', value: JSON.stringify(message) }]
      });
    } catch (error) {
      console.error(`❌ Error sending to alerts-service:`, error);
    }
  }

  /**
   * Thay thế các placeholder trong message với giá trị thực tế
   * @param {string} message - Message template
   * @param {Object} sensorData - Sensor data
   * @param {string} sensorType - Type of sensor
   * @param {number} sensorValue - Current sensor value
   * @param {number} threshold - Threshold value
   * @param {string} operator - Comparison operator
   * @returns {string}
   */
  replacePlaceholders(message, sensorData, sensorType, sensorValue, threshold, operator) {
    if (!message) return message;

    // Đảm bảo có dữ liệu sensor hợp lệ
    const temp = sensorData.temp !== undefined && sensorData.temp !== null ? sensorData.temp : 'N/A';
    const humid = sensorData.humid !== undefined && sensorData.humid !== null ? sensorData.humid : 'N/A';
    const smoke = sensorData.smoke !== undefined && sensorData.smoke !== null ? sensorData.smoke : 'N/A';
    const gasPpm = sensorData.gas_ppm !== undefined && sensorData.gas_ppm !== null ? sensorData.gas_ppm : 'N/A';

    // Thay thế các placeholder chung
    let result = message
      .replace(/\{temperature\}/g, temp)
      .replace(/\{humidity\}/g, humid)
      .replace(/\{smoke\}/g, smoke)
      .replace(/\{gas_ppm\}/g, gasPpm)
      .replace(/\{sensorValue\}/g, sensorValue !== undefined ? sensorValue : 'N/A')
      .replace(/\{threshold\}/g, threshold !== undefined ? threshold : 'N/A')
      .replace(/\{operator\}/g, operator || '>')
      .replace(/\{sensorType\}/g, sensorType || 'unknown');

    // Replace sensor-specific placeholders
    switch (sensorType) {
      case 'temperature':
        result = result.replace(/\{temp\}/g, temp);
        break;
      case 'humidity':
        result = result.replace(/\{humid\}/g, humid);
        break;
      case 'smoke':
        result = result.replace(/\{smoke_value\}/g, smoke);
        break;
      case 'gas_ppm':
        result = result.replace(/\{gas_value\}/g, gasPpm);
        break;
    }
    return result;
  }
}

export default RuleEvaluationService;
