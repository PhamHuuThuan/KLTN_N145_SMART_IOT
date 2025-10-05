import Rule from '../models/Rule.js';
import mongoose from 'mongoose';
import { Kafka } from 'kafkajs';

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
  }

  /**
   * Đánh giá tất cả rules cho một device khi nhận dữ liệu sensor
   * @param {string} deviceId - ID của device
   * @param {Object} sensorData - Dữ liệu sensor từ device
   * @param {string} ownerId - ID của chủ sở hữu device
   */
  async evaluateRules(deviceId, sensorData, ownerId = null) {
    try {
      console.log(`🔍 Evaluating rules for device: ${deviceId}`);
      console.log(`📊 Sensor data:`, sensorData);

      // Lấy tất cả rules active cho device này
      const query = { 
        deviceId, 
        isActive: true 
      };
      
      if (ownerId) {
        if (mongoose.Types.ObjectId.isValid(ownerId)) {
          query.ownerId = new mongoose.Types.ObjectId(ownerId);
        } else {
          console.log(`⚠️ Provided ownerId is not a valid ObjectId, ignoring owner filter:`, ownerId);
        }
      }

      const rules = await Rule.find(query);
      console.log(`📋 Found ${rules.length} active rules for device ${deviceId}`);
      console.log(`🔍 Query used:`, JSON.stringify(query, null, 2));
      
      // Debug: Log all rules in database for this device
      const allRules = await Rule.find({ deviceId });
      console.log(`🔍 All rules for device ${deviceId}:`, allRules.length);
      allRules.forEach(rule => {
        console.log(`  - Rule: ${rule.name}, Active: ${rule.isActive}, Owner: ${rule.ownerId}`);
      });

      if (rules.length === 0) {
        console.log(`⚠️ No active rules found for device ${deviceId}`);
        return;
      }

      // Đánh giá từng rule
      for (const rule of rules) {
        await this.evaluateRule(rule, sensorData);
      }

    } catch (error) {
      console.error(`❌ Error evaluating rules for device ${deviceId}:`, error);
    }
  }

  /**
   * Đánh giá một rule cụ thể
   * @param {Object} rule - Rule object từ database
   * @param {Object} sensorData - Dữ liệu sensor hiện tại
   */
  async evaluateRule(rule, sensorData) {
    try {
      console.log(`🔍 Evaluating rule: ${rule.name} (ID: ${rule._id})`);

      // Kiểm tra cooldown period
      if (this.isInCooldown(rule)) {
        console.log(`⏰ Rule ${rule.name} is in cooldown period`);
        return;
      }

      // Kiểm tra max triggers per day
      if (this.hasExceededDailyLimit(rule)) {
        console.log(`🚫 Rule ${rule.name} has exceeded daily trigger limit`);
        return;
      }

      // Đánh giá tất cả conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions, sensorData);
      
      if (conditionsMet) {
        console.log(`✅ Rule ${rule.name} conditions met! Triggering actions...`);
        await this.executeActions(rule, sensorData);
        await this.updateRuleTriggerInfo(rule);
      } else {
        console.log(`❌ Rule ${rule.name} conditions not met`);
      }

    } catch (error) {
      console.error(`❌ Error evaluating rule ${rule.name}:`, error);
    }
  }

  /**
   * Đánh giá tất cả conditions của rule
   * @param {Array} conditions - Array of conditions
   * @param {Object} sensorData - Dữ liệu sensor
   * @returns {boolean} - True nếu tất cả conditions được thỏa mãn
   */
  async evaluateConditions(conditions, sensorData) {
    for (const condition of conditions) {
      const conditionMet = await this.evaluateCondition(condition, sensorData);
      if (!conditionMet) {
        return false;
      }
    }
    return true;
  }

  /**
   * Đánh giá một condition cụ thể
   * @param {Object} condition - Condition object
   * @param {Object} sensorData - Dữ liệu sensor
   * @returns {boolean} - True nếu condition được thỏa mãn
   */
  async evaluateCondition(condition, sensorData) {
    switch (condition.type) {
      case 'sensor':
        return this.evaluateSensorCondition(condition, sensorData);
      case 'time':
        return this.evaluateTimeCondition(condition);
      case 'device_status':
        return this.evaluateDeviceStatusCondition(condition, sensorData);
      case 'outlet_status':
        return this.evaluateOutletStatusCondition(condition, sensorData);
      case 'emergency':
        return this.evaluateEmergencyCondition(sensorData);
      default:
        console.log(`⚠️ Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Đánh giá sensor condition
   * @param {Object} condition - Sensor condition
   * @param {Object} sensorData - Dữ liệu sensor
   * @returns {boolean}
   */
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

  /**
   * Đánh giá time condition
   * @param {Object} condition - Time condition
   * @returns {boolean}
   */
  evaluateTimeCondition(condition) {
    const { timeCondition } = condition;
    if (!timeCondition) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Kiểm tra ngày trong tuần
    if (timeCondition.days && timeCondition.days.length > 0) {
      if (!timeCondition.days.includes(currentDay)) {
        return false;
      }
    }

    // Kiểm tra giờ và phút
    if (timeCondition.hour !== undefined && timeCondition.minute !== undefined) {
      return currentHour === timeCondition.hour && currentMinute === timeCondition.minute;
    } else if (timeCondition.hour !== undefined) {
      return currentHour === timeCondition.hour;
    }

    return true;
  }

  /**
   * Đánh giá device status condition
   * @param {Object} condition - Device status condition
   * @param {Object} sensorData - Dữ liệu sensor
   * @returns {boolean}
   */
  evaluateDeviceStatusCondition(condition, sensorData) {
    // Implement device status logic here
    // For now, return true as placeholder
    return true;
  }

  /**
   * Đánh giá outlet status condition
   * @param {Object} condition - Outlet status condition
   * @param {Object} sensorData - Dữ liệu sensor
   * @returns {boolean}
   */
  evaluateOutletStatusCondition(condition, sensorData) {
    const { outletId } = condition;
    if (!outletId) return false;

    const outletStatus = sensorData.o?.[outletId] || sensorData.outlets?.[outletId];
    return outletStatus !== undefined;
  }

  /**
   * Đánh giá emergency condition
   * @param {Object} sensorData - Dữ liệu sensor
   * @returns {boolean}
   */
  evaluateEmergencyCondition(sensorData) {
    // Kiểm tra các điều kiện khẩn cấp
    const temp = sensorData.temp;
    const smoke = sensorData.smoke;
    const gasPpm = sensorData.gas_ppm;

    return (temp > 60) || (smoke > 100) || (gasPpm > 1000);
  }

  /**
   * Thực thi các actions của rule
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
  async executeActions(rule, sensorData) {
    try {
      console.log(`🎯 Executing ${rule.actions.length} actions for rule: ${rule.name}`);
      
      // Connect producer if not already connected
      if (!this.producerConnected) {
        await this.producer.connect();
        this.producerConnected = true;
        console.log('✅ Kafka producer connected');
      }

      for (const action of rule.actions) {
        await this.executeAction(action, rule, sensorData);
      }

    } catch (error) {
      console.error(`❌ Error executing actions for rule ${rule.name}:`, error);
    }
  }

  /**
   * Thực thi một action cụ thể
   * @param {Object} action - Action object
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
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
        case 'toggle_outlet':
          await this.toggleOutletAction(action, rule, sensorData);
          break;
        case 'activate_emergency':
          await this.activateEmergencyAction(action, rule, sensorData);
          break;
        case 'log_event':
          await this.logEventAction(action, rule, sensorData);
          break;
        default:
          console.log(`⚠️ Unknown action type: ${action.type}`);
      }

    } catch (error) {
      console.error(`❌ Error executing action ${action.type}:`, error);
    }
  }

  /**
   * Gửi notification action
   * @param {Object} action - Action object
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
  async sendNotificationAction(action, rule, sensorData) {
    try {
      // Tạo message chi tiết dựa trên sensor data
      const sensorType = this.getTriggeredSensorType(rule.conditions, sensorData);
      const sensorValue = this.getTriggeredSensorValue(rule.conditions, sensorData);
      const threshold = this.getTriggeredThreshold(rule.conditions);
      const operator = this.getTriggeredOperator(rule.conditions);
      
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

      // Determine risk level
      const isDangerousSensor = sensorType === 'smoke' || sensorType === 'gas_ppm';
      const tempHigh = sensorType === 'temperature' && Number(sensorValue) >= 80;
      const elevateSecurity = isDangerousSensor || tempHigh;

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

      const message = {
        userId: rule.ownerId.toString(),
        title: title,
        message: detailedMessage,
        type: elevateSecurity ? 'security_alert' : 'device_alert',
        category: elevateSecurity ? 'security' : 'rule',
        priority: elevateSecurity ? 'urgent' : (action.priority || 'medium'),
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

      console.log(`📧 Sending notification to Kafka:`, {
        topic: 'notification-requests',
        userId: rule.ownerId.toString(),
        ruleId: rule._id.toString(),
        ruleName: rule.name
      });

      const result = await this.producer.send({
        topic: 'notification-requests',
        messages: [{
          key: rule.ownerId.toString(),
          value: JSON.stringify(message)
        }]
      });

      console.log(`✅ Notification sent successfully for rule: ${rule.name}`, {
        partition: result[0].partition,
        offset: result[0].offset
      });
    } catch (error) {
      console.error(`❌ Error sending notification for rule ${rule.name}:`, error);
    }
  }

  /**
   * Gửi alert action
   * @param {Object} action - Action object
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
  async sendAlertAction(action, rule, sensorData) {
    // Infer severity from sensor data
    const sensorType = this.getTriggeredSensorType(rule.conditions, sensorData);
    const sensorValue = this.getTriggeredSensorValue(rule.conditions, sensorData);
    const threshold = this.getTriggeredThreshold(rule.conditions);
    const isDangerousSensor = sensorType === 'smoke' || sensorType === 'gas_ppm';
    const tempHigh = sensorType === 'temperature' && Number(sensorValue) >= 80;
    const elevateSecurity = isDangerousSensor || tempHigh;

    const message = {
      deviceId: rule.deviceId,
      deviceName: `Device ${rule.deviceId}`,
      sensorType,
      sensorValue,
      threshold,
      alertType: 'threshold_exceeded',
      category: elevateSecurity ? 'security' : 'sensor',
      priority: elevateSecurity ? 'urgent' : 'medium',
      userId: rule.ownerId,
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      message: action.message || `Alert: ${rule.name} triggered`
    };

    await this.producer.send({
      topic: 'device-alerts',
      messages: [{
        key: rule.deviceId,
        value: JSON.stringify(message)
      }]
    });

    console.log(`🚨 Alert sent for rule: ${rule.name}`);
  }

  /**
   * Toggle outlet action
   * @param {Object} action - Action object
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
  async toggleOutletAction(action, rule, sensorData) {
    const message = {
      deviceId: rule.deviceId,
      outletId: action.outletId,
      status: action.status,
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      timestamp: new Date().toISOString()
    };

    await this.producer.send({
      topic: 'outlet-control',
      messages: [{
        key: `${rule.deviceId}-${action.outletId}`,
        value: JSON.stringify(message)
      }]
    });

    console.log(`🔌 Outlet ${action.outletId} toggled for rule: ${rule.name}`);
  }

  /**
   * Activate emergency action
   * @param {Object} action - Action object
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
  async activateEmergencyAction(action, rule, sensorData) {
    const message = {
      deviceId: rule.deviceId,
      action: 'emergency_mode_activated',
      reason: `Rule triggered: ${rule.name}`,
      timestamp: new Date().toISOString(),
      telemetry: sensorData,
      ruleId: rule._id.toString()
    };

    await this.producer.send({
      topic: 'device.emergency',
      messages: [{
        key: rule.deviceId,
        value: JSON.stringify(message)
      }]
    });

    console.log(`🚨 Emergency mode activated for rule: ${rule.name}`);
  }

  /**
   * Log event action
   * @param {Object} action - Action object
   * @param {Object} rule - Rule object
   * @param {Object} sensorData - Dữ liệu sensor
   */
  async logEventAction(action, rule, sensorData) {
    const message = {
      deviceId: rule.deviceId,
      type: 'rule_event',
      payload: {
        ruleId: rule._id.toString(),
        ruleName: rule.name,
        action: action.type,
        sensorData: sensorData,
        timestamp: new Date().toISOString()
      },
      severity: action.priority || 'medium'
    };

    await this.producer.send({
      topic: 'iot.events.logs',
      messages: [{
        key: rule.deviceId,
        value: JSON.stringify(message)
      }]
    });

    console.log(`📝 Event logged for rule: ${rule.name}`);
  }

  /**
   * Kiểm tra cooldown period
   * @param {Object} rule - Rule object
   * @returns {boolean}
   */
  isInCooldown(rule) {
    if (!rule.lastTriggeredAt || !rule.cooldownPeriod) {
      return false;
    }

    const now = new Date();
    const timeSinceLastTrigger = now.getTime() - rule.lastTriggeredAt.getTime();
    return timeSinceLastTrigger < rule.cooldownPeriod;
  }

  /**
   * Kiểm tra daily trigger limit
   * @param {Object} rule - Rule object
   * @returns {boolean}
   */
  hasExceededDailyLimit(rule) {
    if (!rule.settings?.maxTriggersPerDay) {
      return false;
    }

    // Reset trigger count if it's a new day
    const now = new Date();
    const lastTriggered = rule.lastTriggeredAt;
    
    if (!lastTriggered) {
      return false;
    }

    const isNewDay = now.toDateString() !== lastTriggered.toDateString();
    if (isNewDay) {
      // Reset trigger count for new day
      rule.triggerCount = 0;
      rule.save();
      return false;
    }

    return rule.triggerCount >= rule.settings.maxTriggersPerDay;
  }

  /**
   * Cập nhật thông tin trigger của rule
   * @param {Object} rule - Rule object
   */
  async updateRuleTriggerInfo(rule) {
    try {
      // Chỉ update nếu rule có method save (Mongoose document)
      if (rule.save && typeof rule.save === 'function') {
        rule.lastTriggeredAt = new Date();
        rule.triggerCount += 1;
        await rule.save();
        
        console.log(`📊 Updated trigger info for rule: ${rule.name}`);
      } else {
        // Nếu không phải Mongoose document, chỉ log
        console.log(`📊 Rule triggered: ${rule.name} (test mode - no database update)`);
      }
    } catch (error) {
      console.error(`❌ Error updating trigger info for rule ${rule.name}:`, error);
    }
  }

  /**
   * Lấy loại sensor được trigger
   * @param {Array} conditions - Rule conditions
   * @param {Object} sensorData - Sensor data
   * @returns {string}
   */
  getTriggeredSensorType(conditions, sensorData) {
    for (const condition of conditions) {
      if (condition.type === 'sensor' && condition.sensor) {
        return condition.sensor;
      }
    }
    return 'unknown';
  }

  /**
   * Lấy giá trị sensor được trigger
   * @param {Array} conditions - Rule conditions
   * @param {Object} sensorData - Sensor data
   * @returns {number}
   */
  getTriggeredSensorValue(conditions, sensorData) {
    for (const condition of conditions) {
      if (condition.type === 'sensor' && condition.sensor) {
        switch (condition.sensor) {
          case 'temperature':
            return sensorData.temp !== undefined ? sensorData.temp : 0;
          case 'humidity':
            return sensorData.humid !== undefined ? sensorData.humid : 0;
          case 'gas_ppm':
            return sensorData.gas_ppm !== undefined ? sensorData.gas_ppm : 0;
          case 'smoke':
            return sensorData.smoke !== undefined ? sensorData.smoke : 0;
        }
      }
    }
    return 0;
  }

  /**
   * Lấy ngưỡng được trigger
   * @param {Array} conditions - Rule conditions
   * @returns {number}
   */
  getTriggeredThreshold(conditions) {
    for (const condition of conditions) {
      if (condition.type === 'sensor' && condition.value !== undefined) {
        return condition.value;
      }
    }
    return 0;
  }

  /**
   * Lấy operator được trigger
   * @param {Array} conditions - Rule conditions
   * @returns {string}
   */
  getTriggeredOperator(conditions) {
    for (const condition of conditions) {
      if (condition.type === 'sensor' && condition.operator) {
        return condition.operator;
      }
    }
    return '>';
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

    // Ensure we have valid sensor data
    const temp = sensorData.temp !== undefined && sensorData.temp !== null ? sensorData.temp : 'N/A';
    const humid = sensorData.humid !== undefined && sensorData.humid !== null ? sensorData.humid : 'N/A';
    const smoke = sensorData.smoke !== undefined && sensorData.smoke !== null ? sensorData.smoke : 'N/A';
    const gasPpm = sensorData.gas_ppm !== undefined && sensorData.gas_ppm !== null ? sensorData.gas_ppm : 'N/A';

    // Replace common placeholders
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
