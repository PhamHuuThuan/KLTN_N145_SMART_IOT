import Rule from '../models/Rule.js';
import { Kafka } from 'kafkajs';
import RulePriorityService from './RulePriorityService.js';
import logger from '../utils/logger.js';
import fetch from 'node-fetch';

class RuleEvaluationService {
  constructor() {
    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:29092').split(',').map(b => b.trim());
    logger.info(`Kafka brokers (producer) configured: ${JSON.stringify(kafkaBrokers)}`);
    
    this.kafka = new Kafka({
      clientId: 'rules-service',
      brokers: kafkaBrokers,
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

    // ML support configuration
    this.mlSupportEnabled = process.env.ML_SUPPORT_ENABLED !== 'false';
    this.mlSupportThreshold = Number(process.env.ML_SUPPORT_THRESHOLD || '0.8');
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:3007';
    this.mlRequestTimeoutMs = Number(process.env.ML_SUPPORT_TIMEOUT_MS || '1500');
    this.mlAlertCooldown = Number(process.env.ML_ALERT_COOLDOWN_MS || '300000');
    
    this.lastMlAlertTime = new Map();
    
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
          case 'flame':
            sensorValue = sensorData.flame;
            if (sensorValue !== undefined && sensorValue !== null) {
              sensorValue = Number(sensorValue);
            }
            break;
          default:
            break;
        }
        break;
      }
    }

    return { sensorType, sensorValue, threshold, operator };
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
      case 'flame':
        return 'Cảnh báo lửa';
      default:
        return `Cảnh báo ${sensorType}`;
    }
  }

  // Đánh giá tất cả rules cho một device khi nhận dữ liệu sensor
  async evaluateRules(deviceId, sensorData) {
    try {
      if (!sensorData.deviceId) {
        sensorData.deviceId = deviceId;
      }
      const now = Date.now();
      const lastTime = this.lastEvaluationTime.get(deviceId);
      // if (lastTime && (now - lastTime) < this.evaluationCooldown) {
      //   return;
      // }
      
      this.lastEvaluationTime.set(deviceId, now);

      const query = { 
        deviceId, 
        isActive: true,
        deletedAt: null
      };
      
      const rules = await Rule.find(query);
  
      let triggeredRules = [];
      if (rules.length > 0) {
        triggeredRules = await Promise.all(
          rules.map(async rule => {
            try {
              return (await this.evaluateRule(rule, sensorData)) ? rule : null;
            } catch (err) {
              return null;
            }
          })
        ).then(results => results.filter(Boolean));
      }
  
      // 📢 Xử lý kết quả theo priority
      let hasRuleTriggered = false;
      if (triggeredRules.length > 1) {
        hasRuleTriggered = true;
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
            const consolidatedMessage = this.priorityService.buildDetailedConsolidatedNotification(incident, null, sensorData);
            
            await this.sendToAlertsService(consolidatedMessage);
            logger.info(`Consolidated alert sent for ${priorityLevel} priority - ${rules.length} rules`);
          } else {
            // Gửi individual notification cho rule đơn lẻ
            await this.executeActions(rules[0], sensorData).catch(err => {});
            logger.info(`Individual alert sent for ${priorityLevel} priority - ${rules[0].name}`);
          }
        }
        
      } else if (triggeredRules.length === 1) {
        hasRuleTriggered = true;
        logger.info(`Single rule triggered: ${triggeredRules[0].name}`);
        
        // Send individual notification for single rule
        const rule = triggeredRules[0];
        await this.executeActions(rule, sensorData).catch(err => {});
        logger.info(`Single rule alert sent - Rule: ${rule.name}`);
      }

      if (!hasRuleTriggered) {
        await this.evaluateMlAnomaly(deviceId, sensorData);
      } else {
        logger.debug(`Skipping ML anomaly alert for ${deviceId} - rule(s) already triggered`);
      }
    } catch (err) {
      logger.error(`evaluateRules() error for device ${deviceId}:`, err);
    }
  }  

  // Đánh giá một rule cụ thể
  async evaluateRule(rule, sensorData) {
    try {
      if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
        logger.warn(`Rule ${rule.name} has no conditions; skipping evaluation`);
        return false;
      }
      const { priority } = rule;

      // Special handling for urgent rules - always trigger regardless of cooldown/limits
      const isUrgent = priority === 'urgent';
      
      if (!isUrgent) {
        // Check if rule can trigger with escalation logic
        const canTrigger = await this.checkRuleCanTrigger(rule, sensorData);
        if (!canTrigger) {
          logger.debug(`${rule.name}: skipped (cooldown or escalation gating)`);
          return false;
        }
      }

      // Đánh giá tất cả conditions với logic
      const conditionsMet = await this.evaluateConditions(rule.conditions, sensorData);
      if (!conditionsMet) {
        return false;
      }
      
      // Increment trigger count and update last triggered time (skip for urgent rules)
      if (!isUrgent) {
        await rule.incrementTriggerCount();
      }
      
      // Don't execute actions here - let evaluateRules handle it
      return true;
    } catch (err) {
      logger.error(`evaluateRule() error for ${rule.name}:`, err);
      return false;
    }
  }

  // Kiểm tra rule có thể trigger với escalation logic
  async checkRuleCanTrigger(rule, sensorData) {
    const { priority } = rule;
    
    // Urgent rules luôn bypass tất cả giới hạn
    if (priority === 'urgent') {
      return true;
    }
    
    const { sensorType, sensorValue } = this.getSensorInfo(rule, sensorData);
    
    const canTrigger = await rule.canTrigger(sensorValue, sensorType);
    if (canTrigger) {
      return true;
    }
    
    // thì cần check nếu có escalation để gửi alert
    if (sensorValue && sensorType) {
      const condition = rule.conditions.find(c => c.sensor === sensorType);
      if (condition && condition.value) {
        const escalationMet = rule.shouldEscalate(sensorValue, sensorType);
        if (escalationMet) {
          logger.warn(`🚨 ESCALATION → URGENT: ${rule.name} bypassing cooldown - ${sensorType}: ${sensorValue}`);
          
          await this.createEscalationAlert(rule, sensorData, {
            sensor: sensorType,
            currentValue: sensorValue,
            threshold: condition.value,
            reason: 'escalation'
          });
          
          return true;
        }
      }
    }
    
    return false;
  }

  // Tạo escalation alert
  async createEscalationAlert(rule, sensorData, escalationInfo) {
    const { sensor, currentValue, threshold, reason } = escalationInfo;
    const { name, priority, createdBy } = rule;
    
    let title, message;
    
    title = `🚨 CẢNH BÁO KHẨN CẤP: ${name}`;
    const hasThreshold = threshold !== undefined && threshold !== null;
    const deviationPercent = hasThreshold && threshold !== 0
      ? ((currentValue - threshold) / threshold * 100).toFixed(1)
      : null;
    const thresholdText = hasThreshold && deviationPercent !== null
      ? `📈 Ngưỡng ban đầu: ${threshold}\n⚠️ Độ lệch: +${deviationPercent}%\n`
      : hasThreshold
        ? `📈 Ngưỡng ban đầu: ${threshold}\n`
        : '';
    message = `🚨 ${sensor} đã tăng ĐỘT NGỘT và có nguy cơ nguy hiểm!\n\n` +
             `📊 Giá trị hiện tại: ${currentValue}\n` +
             thresholdText +
             `⏰ Thời gian: ${new Date().toLocaleString()}\n\n` +
             `🚨 ĐÁNH GIÁ: Tình trạng NGHIÊM TRỌNG - Cần xử lý ngay!`;
    
    const escalationMessage = {
      userId: createdBy,
      title,
      message,
      priority: 'urgent',
      type: 'escalation_alert',
      category: 'security', // ✅ Chuyển sang security để FE hiển thị emergency
      metadata: {
        ruleId: rule._id,
        ruleName: name,
        sensor,
        currentValue,
        threshold,
        escalationReason: reason,
        cooldownBypassed: reason === 'escalation',
        triggerCount: rule.triggerCount,
        deviceId: sensorData.deviceId
      }
    };
    
    await this.sendToAlertsService(escalationMessage);
    logger.info(`🚨 ESCALATION ALERT sent as URGENT for rule: ${name} - Reason: ${reason}`);
  }

  // Đánh giá tất cả conditions của rule (mặc định AND)
  async evaluateConditions(conditions, sensorData) {
    if (!conditions || conditions.length === 0) {
      logger.warn('evaluateConditions() skipped: rule has no conditions configured');
      return false;
    }

    // Nếu chỉ có 1 điều kiện, chỉ cần đánh giá điều kiện đó
    if (conditions.length === 1) {
      return await this.evaluateCondition(conditions[0], sensorData);
    }

    const results = [];
    for (const condition of conditions) {
      const conditionMet = await this.evaluateCondition(condition, sensorData);
      results.push(conditionMet);
    }

    // Mặc định sử dụng logic AND
    return results.every(result => result === true);
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
  async evaluateSensorCondition(condition, sensorData) {
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
      case 'flame':
        sensorValue = sensorData.flame;
        if (sensorValue !== undefined && sensorValue !== null) {
          sensorValue = Number(sensorValue);
        }
        break;
      default:
        logger.warn(`Unknown sensor type: ${sensor}`);
        return false;
    }

    if (sensorValue === undefined || sensorValue === null) {
      logger.warn(`Sensor value not available: ${sensor}`);
      return false;
    }

    const normalizedExpected = Array.isArray(value)
      ? value.map(item => (typeof item === 'string' ? Number(item) : item))
      : (typeof value === 'string' ? Number(value) : value);

    const thresholdMet = this.compareValues(sensorValue, operator, normalizedExpected);

    if (!this.mlSupportEnabled || !sensorData.deviceId) {
      return thresholdMet;
    }

    try {
      const mlSupport = await this.fetchMlSupport(sensorData.deviceId, sensorData);
      if (!mlSupport || !mlSupport.predictions) {
        return thresholdMet;
      }

      const sensorMl = mlSupport.predictions[sensor];
      const supportScore = sensorMl?.prediction_score ?? mlSupport.device?.overall_score;
      const mlAlertLevel = sensorMl?.alert_level ?? mlSupport.device?.alert_level;
      const mlPromoted = !thresholdMet && typeof supportScore === 'number' && supportScore >= this.mlSupportThreshold;

      if (mlPromoted) {
        logger.info(`ML support promoted condition for ${sensorData.deviceId}:${sensor} (score=${supportScore})`);
      }

      this.attachMlMetadata(sensorData, sensor, {
        score: supportScore,
        alertLevel: mlAlertLevel,
        promoted: mlPromoted,
        thresholdMet,
      });

      return thresholdMet || mlPromoted;
    } catch (error) {
      return thresholdMet;
    }
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
          case 'flame': {
            const flameStatus = Number(sensorValue) >= 1 ? 'phát hiện lửa' : 'an toàn';
            detailedMessage = `Cảm biến lửa ${flameStatus}. Giá trị hiện tại: ${sensorValue}`;
            break;
          }
          default:
            detailedMessage = `Rule "${rule.name}" has been triggered. Sensor: ${sensorType}, Value: ${sensorValue}, Threshold: ${threshold}`;
        }
      } else {
        detailedMessage = this.replacePlaceholders(detailedMessage, sensorData, sensorType, sensorValue, threshold, operator);
      }

      // Determine if this should be elevated to security alert
      const elevateSecurity = sensorType === 'gas_ppm' || 
                              sensorType === 'flame' ||
                              (sensorType === 'smoke' && Number(sensorValue) === 1) || 
                              (sensorType === 'temperature' && Number(sensorValue) >= 80);

      // Tạo title với placeholder replacement
      let title = action.title || this.getDefaultTitle(sensorType);
      title = this.replacePlaceholders(title, sensorData, sensorType, sensorValue, threshold, operator);
      if (!rule.createdBy) {
        logger.error(`Rule ${rule.name} has no createdBy, skipping notification`);
        return;
      }

      const message = {
        userId: rule.createdBy,
        title: title,
        message: detailedMessage,
        type: elevateSecurity ? 'security_alert' : 'device_alert',
        category: elevateSecurity ? 'security' : 'rule',
        priority: elevateSecurity ? 'urgent' : (rule.priority || 'medium'),
        metadata: {
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          deviceId: rule.deviceId,
          deviceName: sensorData.deviceName || `Device ${rule.deviceId}`,
          sensorData: sensorData,
          actionType: action.type,
          sensorType: sensorType,
          sensorValue: sensorValue,
          threshold: threshold,
          operator: operator,
          mlSupport: sensorData.__mlMeta?.[sensorType] || null
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
    const elevateSecurity = sensorType === 'gas_ppm' || 
                            sensorType === 'flame' ||
                            (sensorType === 'smoke' && Number(sensorValue) === 1) || 
                            (sensorType === 'temperature' && Number(sensorValue) >= 80);

    if (!rule.createdBy) {
      logger.error(`Rule ${rule.name} has no createdBy, skipping alert`);
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
      userId: rule.createdBy,
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      message: action.message || (sensorType === 'flame'
        ? `Cảm biến lửa phát hiện ngọn lửa (Giá trị: ${sensorValue})`
        : `Alert: ${rule.name} triggered`),
      mlSupport: sensorData.__mlMeta?.[sensorType] || null
    };

    try {
      await this.ensureKafkaConnection();
      
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

  // Helper method để connect Kafka producer
  async ensureKafkaConnection() {
    if (!this.producerConnected) {
      try {
        await this.producer.connect();
        this.producerConnected = true;
        logger.info('Kafka producer connected');
      } catch (connectError) {
        logger.error('Failed to connect Kafka producer:', connectError);
        throw connectError;
      }
    }
  }

  // Gửi message đến alerts-service qua Kafka
  async sendToAlertsService(message) {
    try {
      await this.ensureKafkaConnection();

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

  replacePlaceholders(message, sensorData, sensorType, sensorValue, threshold, operator) {
    if (!message) return message;

    // Đảm bảo có dữ liệu sensor hợp lệ
    const temp = sensorData.temp !== undefined && sensorData.temp !== null ? sensorData.temp : 'N/A';
    const humid = sensorData.humid !== undefined && sensorData.humid !== null ? sensorData.humid : 'N/A';
    const smoke = sensorData.smoke !== undefined && sensorData.smoke !== null ? sensorData.smoke : 'N/A';
    const gasPpm = sensorData.gas_ppm !== undefined && sensorData.gas_ppm !== null ? sensorData.gas_ppm : 'N/A';
    const flameValue = sensorData.flame !== undefined && sensorData.flame !== null ? Number(sensorData.flame) : null;
    const flameDisplay = flameValue !== null && !Number.isNaN(flameValue) ? flameValue : 'N/A';

    let result = message
      .replace(/\{temperature\}/g, temp)
      .replace(/\{humidity\}/g, humid)
      .replace(/\{smoke\}/g, smoke)
      .replace(/\{gas_ppm\}/g, gasPpm)
      .replace(/\{flame\}/g, flameDisplay)
      .replace(/\{sensorValue\}/g, sensorValue !== undefined ? sensorValue : 'N/A')
      .replace(/\{threshold\}/g, threshold !== undefined ? threshold : 'N/A')
      .replace(/\{operator\}/g, operator || '>')
      .replace(/\{sensorType\}/g, sensorType || 'unknown')
      .replace(/\{deviceId\}/g, sensorData.deviceId || 'Unknown Device')
      .replace(/\{deviceName\}/g, sensorData.deviceName || (sensorData.deviceId ? `Device ${sensorData.deviceId}` : 'Unknown Device'));

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
      case 'flame': {
        const flameStatus = flameValue !== null && !Number.isNaN(flameValue) && flameValue >= 1 ? 'có lửa' : 'an toàn';
        result = result.replace(/\{flame_status\}/g, flameStatus);
        break;
      }
    }
    return result;
  }

  buildMlPayload(deviceId, sensorData) {
    if (!deviceId) {
      return null;
    }
    const payload = {};
    const keys = ['temp', 'humid', 'smoke', 'gas_ppm', 'gas'];
    for (const key of keys) {
      const value = sensorData[key];
      if (value !== undefined && value !== null && !isNaN(value) && typeof value === 'number') {
        payload[key] = value;
      }
    }
    if (Object.keys(payload).length === 0) {
      return null;
    }
    return {
      doc: {
        deviceId,
        payload
      }
    };
  }

async fetchMlSupport(deviceId, sensorData) {
    if (!this.mlSupportEnabled) {
      return null;
    }
    sensorData.__mlSupportCache = sensorData.__mlSupportCache || {};
    if (sensorData.__mlSupportCache.fetched) {
      return sensorData.__mlSupportCache.result;
    }

    const body = this.buildMlPayload(deviceId, sensorData);
    if (!body) {
      sensorData.__mlSupportCache.fetched = true;
      sensorData.__mlSupportCache.result = null;
      return null;
    }

    const url = `${this.mlServiceUrl}/api/ml/predict/event/aggregate?compact=true&include_details=true`;
    
    let lastError = null;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.mlRequestTimeoutMs);

      try {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`ML service ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        sensorData.__mlSupportCache.result = {
          device: data.device,
          predictions: data.details || {}
        };
        
        sensorData.__mlSupportCache.fetched = true;
        return sensorData.__mlSupportCache.result;

      } catch (error) {
         clearTimeout(timeoutId);
         lastError = error;
         if (attempt < maxRetries && (error.name === 'AbortError' || error.message.includes('fetch failed'))) {
             continue;
         }
         break;
      }
    }
    
    if (lastError && typeof logger !== 'undefined') {
        logger.warn(`ML support request failed for ${deviceId}: ${lastError.message}`);
    }

    sensorData.__mlSupportCache.result = null;
    sensorData.__mlSupportCache.fetched = true;
    return null;
  }

  attachMlMetadata(sensorData, sensorType, meta) {
    sensorData.__mlMeta = sensorData.__mlMeta || {};
    sensorData.__mlMeta[sensorType] = {
      score: meta.score,
      alertLevel: meta.alertLevel,
      promoted: meta.promoted,
      thresholdMet: meta.thresholdMet,
      timestamp: Date.now()
    };
  }

  async evaluateMlAnomaly(deviceId, sensorData) {
    if (!this.mlSupportEnabled || !deviceId) {
      return;
    }

    try {
      const now = Date.now();
      const lastAlertTime = this.lastMlAlertTime.get(deviceId);
      if (lastAlertTime && (now - lastAlertTime) < this.mlAlertCooldown) {
        return;
      }

      const mlResult = await this.fetchMlSupport(deviceId, sensorData);
      if (!mlResult || !mlResult.device) {
        return;
      }

      const deviceScore = mlResult.device.overall_score;
      const deviceAlertLevel = mlResult.device.alert_level;
      const isDanger = mlResult.device.is_danger;
      const primarySensor = mlResult.device.primary_cause;

      const shouldAlert = isDanger || 
                         (deviceScore >= this.mlSupportThreshold && 
                         (deviceAlertLevel === 'high' || deviceAlertLevel === 'critical'));

      if (!shouldAlert) {
        return;
      }

      const maxSensor = primarySensor || 'unknown';
      let maxSensorValue = null;
      
      if (mlResult.predictions && mlResult.predictions[maxSensor]) {
          maxSensorValue = mlResult.predictions[maxSensor].value;
      }
      
      if (maxSensorValue === null || maxSensorValue === undefined) {
         const keyMap = { 'gas_ppm': 'gas_ppm', 'gas': 'gas_ppm', 'temperature': 'temp', 'humidity': 'humid', 'smoke': 'smoke' };
         const dataKey = keyMap[maxSensor] || maxSensor;
         maxSensorValue = sensorData[dataKey];
      }

      const ownerId = sensorData.ownerId;
      if (!ownerId) {
        return;
      }

      const isCritical = deviceAlertLevel === 'critical';

      const title = isCritical 
        ? `🚨 CẢNH BÁO KHẨN CẤP: AI phát hiện nguy cơ cao!`
        : `⚠️ Cảnh báo thông minh: Phát hiện bất thường`;

      const sensorNameMap = {
        'temperature': 'Nhiệt độ',
        'humidity': 'Độ ẩm',
        'gas': 'Khí gas',
        'gas_ppm': 'Khí gas',
        'smoke': 'Khói',
        'flame': 'Lửa'
      };

      const sensorName = sensorNameMap[maxSensor] || maxSensor;
      
      const message = `Hệ thống AI đã phát hiện mẫu dữ liệu bất thường.\n` +
                      `Nguyên nhân chính: Cảm biến ${sensorName}\n\n` +
                      `Giá trị đo được: ${maxSensorValue !== null && maxSensorValue !== undefined ? maxSensorValue : 'N/A'}\n` +
                      `Điểm bất thường: ${(deviceScore * 100).toFixed(1)}%\n` +
                      `Mức độ cảnh báo: ${deviceAlertLevel === 'critical' ? 'RẤT NGUY HIỂM' : deviceAlertLevel === 'high' ? 'Cao' : 'Trung bình'}\n` +
                      `Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
                      `${isCritical ? '🚨 AI nhận định đây là sự cố nghiêm trọng. Kiểm tra ngay!' : '⚠️ Có dấu hiệu lạ, vui lòng để ý thiết bị.'}`;

      const alertMessage = {
        userId: ownerId,
        title: title,
        message: message,
        type: isCritical ? 'security_alert' : 'device_alert',
        category: isCritical ? 'security' : 'ml_anomaly',
        priority: isCritical ? 'urgent' : 'high',
        metadata: {
          deviceId: deviceId,
          deviceName: `Device ${deviceId}`,
          source: 'ml_multivariate_isolation_forest',
          mlData: {
            overallScore: deviceScore,
            alertLevel: deviceAlertLevel,
            primaryCause: maxSensor,
            predictions: mlResult.predictions
          },
          sensorData: sensorData
        }
      };

      await this.sendToAlertsService(alertMessage);
      
      this.lastMlAlertTime.set(deviceId, now);
      
    } catch (error) {
       
    }
  }

}

export default RuleEvaluationService;
