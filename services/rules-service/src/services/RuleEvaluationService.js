import Rule from '../models/Rule.js';
import mongoose from 'mongoose';
import { Kafka } from 'kafkajs';
import RulePriorityService from './RulePriorityService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('RuleEvaluationService');

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
    
    this.lastEvaluationTime = new Map();
    this.evaluationCooldown = 5000; // 5 seconds minimum between evaluations
  }

  // Extract sensor info from rule + sensorData
  getSensorInfo(rule, sensorData) {
    let sensorType = 'unknown';
    let sensorValue = 0;
    let threshold = 0;
    let operator = '>';

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
          default:
            break;
        }
        break;
      }
    }

    return { sensorType, sensorValue, threshold, operator };
  }

  // Compute severity elevation based on sensor
  shouldElevateSecurity(sensorType, sensorValue) {
    const isGasLeak = sensorType === 'gas_ppm';
    const isSmoke = sensorType === 'smoke';
    const tempHigh = sensorType === 'temperature' && Number(sensorValue) >= 80;
    return isGasLeak || (isSmoke && Number(sensorValue) === 1) || tempHigh;
  }

  // Default title by sensor type
  getDefaultTitle(sensorType) {
    switch (sensorType) {
      case 'temperature':
        return 'Cảnh báo nhiệt độ';
      case 'humidity':
        return 'Cảnh báo độ ẩm';
      case 'gas_ppm':
        return 'Cảnh báo khí gas';
      case 'smoke':
        return 'Cảnh báo khói';
      default:
        return `Cảnh báo ${sensorType}`;
    }
  }

  // Đánh giá tất cả rules cho một device khi nhận dữ liệu sensor
  async evaluateRules(deviceId, sensorData, ownerId = null) {
    try {
      const now = Date.now();
      const lastTime = this.lastEvaluationTime.get(deviceId);
      if (lastTime && (now - lastTime) < this.evaluationCooldown) {
        return;
      }
      
      this.lastEvaluationTime.set(deviceId, now);

      // 🔎 1. Lấy danh sách rule đang hoạt động
      let finalOwnerId = ownerId;
      
      if (!finalOwnerId) {
        const existingRule = await Rule.findOne({ deviceId, isActive: true });
        if (existingRule) {
          finalOwnerId = existingRule.ownerId;
        } else {
          return;
        }
      }
      
      const query = { 
        deviceId, 
        isActive: true,
        ownerId: mongoose.Types.ObjectId.isValid(finalOwnerId) ? new mongoose.Types.ObjectId(finalOwnerId) : finalOwnerId
      };
      
      const rules = await Rule.find(query);
      
      if (!rules.length) {
        return;
      }
  
      // ⚙️ 2. Đánh giá tất cả rule
      const triggeredRules = await Promise.all(
        rules.map(async rule => {
          try {
            return (await this.evaluateRule(rule, sensorData)) ? rule : null;
          } catch (err) {
            return null;
          }
        })
      ).then(results => results.filter(Boolean));
  
      // 📢 3. Xử lý kết quả theo priority
      if (triggeredRules.length > 1) {
        logger.info(`Multiple rules triggered: ${triggeredRules.map(r => r.name).join(', ')}`);
        
        // Sắp xếp theo priority: urgent → high → medium → low
        const sortedRules = this.priorityService.sortByPriority(triggeredRules);
        
        // Nhóm rules theo priority level để gộp thông báo
        const groupedRules = this.priorityService.groupRulesByPriority(sortedRules);
        
        // Gửi thông báo cho từng nhóm priority
        for (const [priorityLevel, rules] of Object.entries(groupedRules)) {
          if (rules.length > 1) {
            // Gộp nhiều rules cùng priority
            const incident = this.priorityService.createIncidentReport(rules, { ...sensorData, deviceId });
            const consolidatedMessage = this.priorityService.buildDetailedConsolidatedNotification(incident, finalOwnerId, sensorData);
            
            await this.sendToAlertsService(consolidatedMessage);
            logger.info(`Consolidated alert sent for ${priorityLevel} priority - ${rules.length} rules`);
          } else {
            // Gửi individual notification cho rule đơn lẻ
            await this.executeActions(rules[0], sensorData).catch(err => {});
            logger.info(`Individual alert sent for ${priorityLevel} priority - ${rules[0].name}`);
          }
        }
        
      } else if (triggeredRules.length === 1) {
        logger.info(`Single rule triggered: ${triggeredRules[0].name}`);
        
        // Send individual notification for single rule
        const rule = triggeredRules[0];
        await this.executeActions(rule, sensorData).catch(err => {});
        logger.info(`Single rule alert sent - Rule: ${rule.name}`);
      }
    } catch (err) {
      logger.error(`evaluateRules() error for device ${deviceId}:`, err);
    }
  }  

  // Đánh giá một rule cụ thể
  async evaluateRule(rule, sensorData) {
    try {
      const { name } = rule;

      // Special handling for urgent rules - always trigger regardless of cooldown/limits
      const isUrgent = rule.priority === 'urgent';
      
      if (!isUrgent) {
        // Check if rule can trigger (active, not paused, not in cooldown, not reached daily limit)
        const canTrigger = await rule.canTrigger();
        if (!canTrigger) {
          logger.debug(`${name}: cooldown/daily limit`);
          return false;
        }
      }

      // Đánh giá tất cả conditions với logic
      const conditionsMet = await this.evaluateConditions(rule.conditions, sensorData, rule.conditionLogic);
      if (!conditionsMet) {
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
          await rule.save(); // Save duration tracking state
          return false;
        }
      }
      
      // Increment trigger count and update last triggered time (skip for urgent rules)
      const isUrgentRule = rule.priority === 'urgent';
      if (!isUrgentRule) {
        await rule.incrementTriggerCount();
      }
      
      // Reset duration tracking after successful trigger
      if (rule.duration > 0) {
        rule.resetDurationTracking();
        await rule.save();
      }
      
      // Don't execute actions here - let evaluateRules handle it
      return true;
    } catch (err) {
      logger.error(`evaluateRule() error for ${rule.name}:`, err);
      return false;
    }
  }

  // Đánh giá tất cả conditions của rule với logic AND/OR
  async evaluateConditions(conditions, sensorData, conditionLogic = 'AND') {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    const results = [];
    for (const condition of conditions) {
      const conditionMet = await this.evaluateCondition(condition, sensorData);
      results.push(conditionMet);
    }

    // Apply logic
    if (conditionLogic === 'OR') {
      return results.some(result => result === true);
    } else {
      // Default to AND
      return results.every(result => result === true);
    }
  }

  // Đánh giá một condition cụ thể
  async evaluateCondition(condition, sensorData) {
    if (condition.type === 'sensor') {
      return this.evaluateSensorCondition(condition, sensorData);
    }
    logger.warn(`Unknown condition type: ${condition.type}`);
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
        logger.warn(`Unknown sensor type: ${sensor}`);
        return false;
    }

    if (sensorValue === undefined || sensorValue === null) {
      logger.warn(`Sensor value not available: ${sensor}`);
      return false;
    }

    // So sánh giá trị với ngưỡng (no verbose logging)
    return this.compareValues(sensorValue, operator, value);
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
        logger.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  // Thực thi các actions của rule
  async executeActions(rule, sensorData) {
    try {
      logger.info(`Executing ${rule.actions.length} actions for rule: ${rule.name}`);

      for (const action of rule.actions) {
        try {
          await this.executeAction(action, rule, sensorData);
        } catch (actionError) {
          logger.error(`Error executing action ${action.type} for rule ${rule.name}:`, actionError);
        }
      }
    } catch (error) {
      logger.error(`Error executing actions for rule ${rule.name}:`, error);
    }
  }

  // Thực thi một action cụ thể
  async executeAction(action, rule, sensorData) {
    try {
      logger.info(`Executing action: ${action.type} for rule: ${rule.name}`);

      switch (action.type) {
        case 'send_notification':
          await this.sendNotificationAction(action, rule, sensorData);
          break;
        case 'send_alert':
          await this.sendAlertAction(action, rule, sensorData);
          break;
        default:
          logger.warn(`Unknown action type: ${action.type}`);
      }

    } catch (error) {
      logger.error(`Error executing action ${action.type}:`, error);
    }
  }

  // Gửi notification action
  async sendNotificationAction(action, rule, sensorData) {
    try {
      const { sensorType, sensorValue, threshold, operator } = this.getSensorInfo(rule, sensorData);
      
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

      const elevateSecurity = this.shouldElevateSecurity(sensorType, sensorValue);

      // Enrich sensorData with device identifiers to avoid "Unknown Device"
      const enrichedSensorData = {
        ...sensorData,
        deviceId: sensorData.deviceId || rule.deviceId,
        deviceName: sensorData.deviceName || `Device ${rule.deviceId}`
      };

      // Tạo title với placeholder replacement
      let title = action.title || this.getDefaultTitle(sensorType);
      title = this.replacePlaceholders(title, enrichedSensorData, sensorType, sensorValue, threshold, operator);
      if (!rule.ownerId) {
        logger.error(`Rule ${rule.name} has no ownerId, skipping notification`);
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
          deviceName: enrichedSensorData.deviceName,
          sensorData: sensorData,
          actionType: action.type,
          sensorType: sensorType,
          sensorValue: sensorValue,
          threshold: threshold,
          operator: operator
        }
      };
      await this.sendToAlertsService(message);
    } catch (error) {
      logger.error(`Error sending notification for rule ${rule.name}:`, error);
    }
  }

  // Gửi alert action
  async sendAlertAction(action, rule, sensorData) {
    const { sensorType, sensorValue, threshold } = this.getSensorInfo(rule, sensorData);
    const isGasLeak = sensorType === 'gas_ppm';
    const isSmoke = sensorType === 'smoke';
    const tempHigh = sensorType === 'temperature' && Number(sensorValue) >= 80;
    const elevateSecurity = isGasLeak || (isSmoke && Number(sensorValue) === 1) || tempHigh;

    // Validate required fields
    if (!rule.ownerId) {
      logger.error(`Rule ${rule.name} has no ownerId, skipping alert`);
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
      if (!this.producerConnected) {
        try {
          await this.producer.connect();
          this.producerConnected = true;
          logger.info('Kafka producer connected');
        } catch (connectError) {
          logger.error('Failed to connect Kafka producer:', connectError);
          return;
        }
      }
      await this.producer.send({
        topic: 'device-alerts',
        messages: [{
          key: rule.deviceId,
          value: JSON.stringify(message)
        }]
      });

      logger.info(`Alert sent for rule: ${rule.name}`);
    } catch (kafkaError) {
      logger.error(`Kafka alert send error for rule ${rule.name}:`, kafkaError);
    }
  }

  // Gửi message đến alerts-service qua Kafka
  async sendToAlertsService(message) {
    try {
      if (!this.producerConnected) {
        try {
          await this.producer.connect();
          this.producerConnected = true;
          logger.info('Kafka producer connected');
        } catch (connectError) {
          logger.error('Failed to connect Kafka producer:', connectError);
          return;
        }
      }

      const kafkaMessage = {
        topic: 'notification-requests',
        messages: [{ 
          key: String(message.userId || 'rules-service'), 
          value: JSON.stringify(message) 
        }]
      };

      const result = await this.producer.send(kafkaMessage);
      logger.info(`Message sent successfully to alerts-service:`, result);
      
    } catch (error) {
      logger.error(`Error sending to alerts-service:`, error);
      logger.error(`Error details:`, error.message, error.stack);
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
      .replace(/\{sensorType\}/g, sensorType || 'unknown')
      .replace(/\{deviceId\}/g, sensorData.deviceId || 'Unknown Device')
      .replace(/\{deviceName\}/g, sensorData.deviceName || (sensorData.deviceId ? `Device ${sensorData.deviceId}` : 'Unknown Device'));

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

  // Xử lý phản hồi của người dùng với alert/rule
  async handleUserResponse({ userId, ruleId, response, metadata = {} }) {
    try {
      if (!userId) {
        throw new Error('Unauthorized - user ID required');
      }
      if (!ruleId || !response) {
        throw new Error('ruleId and response are required');
      }

      const validResponses = ['acknowledged', 'dismissed', 'false_alarm'];
      if (!validResponses.includes(response)) {
        throw new Error(`Invalid response. Must be one of: ${validResponses.join(', ')}`);
      }

      const rule = await Rule.findById(ruleId);
      if (!rule) {
        const err = new Error('Rule not found');
        err.statusCode = 404;
        throw err;
      }

      if (rule.ownerId.toString() !== String(userId)) {
        const err = new Error('Access denied - you can only respond to your own rules');
        err.statusCode = 403;
        throw err;
      }

      logger.info(`User ${userId} responded to rule ${rule.name}: ${response}`);

      // Handle rule pausing based on response
      if (response === 'dismissed') {
        rule.pausedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await rule.save();
        logger.info(`Rule ${rule.name} paused for 1 hour`);
      } else if (response === 'false_alarm') {
        rule.pausedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await rule.save();
        logger.info(`Rule ${rule.name} paused for 24 hours`);
      }

      const responseMessage = {
        type: response,
        userId: String(userId),
        ruleId: String(ruleId),
        ruleName: rule.name,
        deviceId: rule.deviceId,
        priority: rule.priority,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          responseTime: Date.now(),
          userAction: response
        }
      };

      try {
        await this.sendToAlertsService({ userId, ...responseMessage });
        logger.info(`User response sent to alerts-service: ${response}`);
      } catch (kafkaError) {
        logger.error('Failed to send user response to alerts-service:', kafkaError);
      }

      return {
        ruleId: String(ruleId),
        ruleName: rule.name,
        response,
        timestamp: new Date()
      };
    } catch (error) {
      throw error;
    }
  }
}

export default RuleEvaluationService;
