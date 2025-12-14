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
      retry: { initialRetryTime: 100, retries: 8 }
    });
    this.producer = this.kafka.producer();
    this.producerConnected = false;
    this.priorityService = new RulePriorityService();
    this.lastMlAlertTime = new Map();
    this.mlSupportCache = new Map();
    this.mlMetadataCache = new Map();

    // ML support configuration
    this.mlSupportEnabled = process.env.ML_SUPPORT_ENABLED !== 'false';
    this.mlSupportThreshold = Number(process.env.ML_SUPPORT_THRESHOLD || '0.8');
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:3007';
    this.mlRequestTimeoutMs = Number(process.env.ML_SUPPORT_TIMEOUT_MS || '1500');
    this.mlAlertCooldown = Number(process.env.ML_ALERT_COOLDOWN_MS || '300000');
  }

  // Lấy giá trị của sensor từ sensorData
  getSensorValue(sensorType, sensorData) {
    const sensorMap = {
      temperature: () => sensorData.temp,
      humidity: () => sensorData.humid,
      gas_ppm: () => sensorData.gas_ppm,
      smoke: () => sensorData.smoke,
      flame: () => {
        const val = sensorData.flame;
        return val !== undefined && val !== null ? Number(val) : val;
      }
    };
    return sensorMap[sensorType]?.() ?? undefined;
  }

  // Lấy thông tin của sensor từ rule và sensorData
  getSensorInfo(rule, sensorData) {
    const sensorCondition = rule.conditions?.find(c => c.type === 'sensor' && c.sensor);
    if (!sensorCondition) {
      return { sensorType: 'unknown', sensorValue: 0, threshold: 0, operator: '>' };
    }

    return {
      sensorType: sensorCondition.sensor,
      sensorValue: this.getSensorValue(sensorCondition.sensor, sensorData),
      threshold: sensorCondition.value || 0,
      operator: sensorCondition.operator || '>'
    };
  }

  // Tạo title mặc định cho rule
  getDefaultTitle(sensorType) {
    const titles = {
      temperature: 'Cảnh báo nhiệt độ',
      humidity: 'Cảnh báo độ ẩm',
      gas_ppm: 'Cảnh báo khí gas',
      smoke: 'Cảnh báo khói',
      flame: 'Cảnh báo lửa'
    };
    return titles[sensorType] || `Cảnh báo ${sensorType}`;
  }

  shouldElevateSecurity(sensorType, sensorValue) {
    return sensorType === 'gas_ppm' || 
           sensorType === 'flame' ||
           (sensorType === 'smoke' && Number(sensorValue) === 1) || 
           (sensorType === 'temperature' && Number(sensorValue) >= 80);
  }

  // Đánh giá tất cả rules cho một device khi nhận dữ liệu sensor
  async evaluateRules(deviceId, sensorData) {
    try {
      sensorData.deviceId = sensorData.deviceId || deviceId;

      const rules = await Rule.find({ deviceId, isActive: true, deletedAt: null });
      if (rules.length === 0) {
        await this.evaluateMlAnomaly(deviceId, sensorData);
        return;
      }

      const triggeredRules = (await Promise.all(
        rules.map(rule => this.evaluateRule(rule, sensorData).then(result => result ? rule : null).catch(() => null))
      )).filter(Boolean);

      if (triggeredRules.length === 0) {
        await this.evaluateMlAnomaly(deviceId, sensorData);
        return;
      }

      if (triggeredRules.length === 1) {
        logger.info(`Single rule triggered: ${triggeredRules[0].name}`);
        await this.executeActions(triggeredRules[0], sensorData).catch(() => {});
        return;
      }

      // Multiple rules triggered - process by priority
      logger.info(`Multiple rules triggered: ${triggeredRules.map(r => r.name).join(', ')}`);
      const groupedRules = this.priorityService.groupRulesByPriority(
        this.priorityService.sortByPriority(triggeredRules)
      );

      for (const [priorityLevel, rules] of Object.entries(groupedRules)) {
        if (rules.length > 1) {
          const incident = this.priorityService.createIncidentReport(rules, { ...sensorData, deviceId });
          const message = this.priorityService.buildDetailedConsolidatedNotification(incident, null, sensorData);
          await this.sendToAlertsService(message);
          await Promise.all(rules.map(rule => rule.incrementTriggerCount().catch(err => 
            logger.error(`Error incrementing trigger count for rule ${rule.name}:`, err)
          )));
          logger.info(`Consolidated alert sent for ${priorityLevel} priority - ${rules.length} rules`);
        } else {
          await this.executeActions(rules[0], sensorData).catch(() => {});
          logger.info(`Individual alert sent for ${priorityLevel} priority - ${rules[0].name}`);
        }
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

      if (rule.priority !== 'urgent') {
        const { sensorType, sensorValue } = this.getSensorInfo(rule, sensorData);
        const canTrigger = await rule.canTrigger(sensorValue, sensorType);
        if (!canTrigger) {
          logger.debug(`${rule.name}: skipped (cooldown or escalation gating)`);
          return false;
        }
      }

      const conditionsMet = await this.evaluateConditions(rule.conditions, sensorData);
      if (!conditionsMet) return false;

      return true;
    } catch (err) {
      logger.error(`evaluateRule() error for ${rule.name}:`, err);
      return false;
    }
  }

  // Đánh giá tất cả conditions của rule
  async evaluateConditions(conditions, sensorData) {
    if (!conditions?.length) {
      logger.warn('evaluateConditions() skipped: rule has no conditions configured');
      return false;
    }

    const results = await Promise.all(conditions.map(condition => {
      if (condition.type !== 'sensor') {
        logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
      }
      return this.evaluateSensorCondition(condition, sensorData);
    }));
    return results.every(r => r === true);
  }

  // Đánh giá sensor condition
  async evaluateSensorCondition(condition, sensorData) {
    const { sensor: sensorType, operator, value } = condition;
    const sensorValue = this.getSensorValue(sensorType, sensorData);

    if (sensorValue === undefined || sensorValue === null) {
      logger.warn(`Sensor value not available: ${sensorType}`);
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
      if (!mlSupport?.predictions) return thresholdMet;

      const sensorMl = mlSupport.predictions[sensorType];
      const supportScore = sensorMl?.prediction_score ?? mlSupport.device?.overall_score;
      const mlAlertLevel = sensorMl?.alert_level ?? mlSupport.device?.alert_level;
      const mlPromoted = !thresholdMet && typeof supportScore === 'number' && supportScore >= this.mlSupportThreshold;

      if (mlPromoted) {
        logger.info(`ML support promoted condition for ${sensorData.deviceId}:${sensorType} (score=${supportScore})`);
      }

      // Store ML metadata for this sensor type (sensorType is a string like 'temperature', 'humidity', etc.)
      this.attachMlMetadata(sensorData.deviceId, sensorType, {
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
      if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
        logger.warn(`Rule ${rule.name} has no actions configured; skipping execution`);
        return;
      }

      logger.info(`Executing ${rule.actions.length} actions for rule: ${rule.name}`);
      
      const actionMap = {
        send_notification: (action) => this.sendNotificationAction(action, rule, sensorData),
        send_alert: (action) => this.sendAlertAction(action, rule, sensorData)
      };

      await Promise.all(rule.actions.map(action => {
        logger.info(`Executing action: ${action.type} for rule: ${rule.name}`);
        const handler = actionMap[action.type];
        if (!handler) {
          logger.warn(`Unknown action type: ${action.type}`);
          return Promise.resolve();
        }
        return handler(action).catch(err =>
          logger.error(`Error executing action ${action.type} for rule ${rule.name}:`, err)
        );
      }));
      
      await rule.incrementTriggerCount();
    } catch (error) {
      logger.error(`Error executing actions for rule ${rule.name}:`, error);
      throw error;
    }
  }

  // Tạo message mặc định cho rule
  getDefaultMessage(sensorType, sensorValue, threshold) {
    const messages = {
      temperature: `Cảm biến nhiệt độ đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}°C, Ngưỡng: ${threshold}°C`,
      humidity: `Cảm biến độ ẩm đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}%, Ngưỡng: ${threshold}%`,
      gas_ppm: `Cảm biến gas_ppm đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}, Ngưỡng: ${threshold}`,
      smoke: `Cảm biến khói đã vượt quá ngưỡng cho phép. Giá trị hiện tại: ${sensorValue}, Ngưỡng: ${threshold}`,
      flame: `Cảm biến lửa ${Number(sensorValue) >= 1 ? 'phát hiện lửa' : 'an toàn'}. Giá trị hiện tại: ${sensorValue}`
    };
    return messages[sensorType] || `Rule triggered. Sensor: ${sensorType}, Value: ${sensorValue}, Threshold: ${threshold}`;
  }

  // Gửi notification action
  async sendNotificationAction(action, rule, sensorData) {
    try {
      if (!rule.createdBy) {
        logger.error(`Rule ${rule.name} has no createdBy, skipping notification`);
        return;
      }

      const { sensorType, sensorValue, threshold, operator } = this.getSensorInfo(rule, sensorData);
      const elevateSecurity = this.shouldElevateSecurity(sensorType, sensorValue);
      
      const detailedMessage = action.message
        ? this.replacePlaceholders(action.message, sensorData, sensorType, sensorValue, threshold, operator)
        : this.getDefaultMessage(sensorType, sensorValue, threshold);

      const title = this.replacePlaceholders(
        action.title || this.getDefaultTitle(sensorType),
        sensorData, sensorType, sensorValue, threshold, operator
      );

      await this.sendToAlertsService({
        userId: rule.createdBy,
        title,
        message: detailedMessage,
        type: elevateSecurity ? 'security_alert' : 'device_alert',
        category: elevateSecurity ? 'security' : 'rule',
        priority: elevateSecurity ? 'urgent' : (rule.priority || 'medium'),
        metadata: {
          ruleId: rule._id.toString(),
          ruleName: rule.name,
          deviceId: rule.deviceId,
          deviceName: sensorData.deviceName || `Device ${rule.deviceId}`,
          sensorData,
          actionType: action.type,
          sensorType,
          sensorValue,
          threshold,
          operator,
          mlSupport: this.getMlMetadata(rule.deviceId, sensorType)
        }
      });
    } catch (error) {
      logger.error(`Error sending notification for rule ${rule.name}:`, error);
    }
  }

  // Gửi alert action
  async sendAlertAction(action, rule, sensorData) {
    if (!rule.createdBy) {
      logger.error(`Rule ${rule.name} has no createdBy, skipping alert`);
      return;
    }

    const { sensorType, sensorValue, threshold } = this.getSensorInfo(rule, sensorData);
    const elevateSecurity = this.shouldElevateSecurity(sensorType, sensorValue);
    const defaultMessage = sensorType === 'flame'
      ? `Cảm biến lửa phát hiện ngọn lửa (Giá trị: ${sensorValue})`
      : `Alert: ${rule.name} triggered`;

    try {
      await this.ensureKafkaConnection();
      await this.producer.send({
        topic: 'device-alerts',
        messages: [{
          key: rule.deviceId,
          value: JSON.stringify({
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
            message: action.message || defaultMessage,
            mlSupport: this.getMlMetadata(rule.deviceId, sensorType)
          })
        }]
      });
      logger.info(`Alert sent for rule: ${rule.name}`);
    } catch (kafkaError) {
      logger.error(`Kafka alert send error for rule ${rule.name}:`, kafkaError);
    }
  }

  // Giúp kết nối Kafka producer
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

    const getValue = (key) => {
      const val = sensorData[key];
      return val !== undefined && val !== null ? val : 'N/A';
    };

    const flameValue = sensorData.flame !== undefined && sensorData.flame !== null ? Number(sensorData.flame) : null;
    const flameDisplay = flameValue !== null && !Number.isNaN(flameValue) ? flameValue : 'N/A';
    const flameStatus = flameValue !== null && !Number.isNaN(flameValue) && flameValue >= 1 ? 'có lửa' : 'an toàn';

    const replacements = {
      temperature: getValue('temp'),
      humidity: getValue('humid'),
      smoke: getValue('smoke'),
      gas_ppm: getValue('gas_ppm'),
      flame: flameDisplay,
      sensorValue: sensorValue !== undefined ? sensorValue : 'N/A',
      threshold: threshold !== undefined ? threshold : 'N/A',
      operator: operator || '>',
      sensorType: sensorType || 'unknown',
      deviceId: sensorData.deviceId || 'Unknown Device',
      deviceName: sensorData.deviceName || (sensorData.deviceId ? `Device ${sensorData.deviceId}` : 'Unknown Device'),
      temp: getValue('temp'),
      humid: getValue('humid'),
      smoke_value: getValue('smoke'),
      gas_value: getValue('gas_ppm'),
      flame_status: flameStatus
    };

    return Object.entries(replacements).reduce((result, [key, value]) => {
      return result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }, message);
  }

  buildMlPayload(deviceId, sensorData) {
    if (!deviceId) return null;
    
    const keys = ['temp', 'humid', 'smoke', 'gas_ppm', 'gas'];
    const payload = Object.fromEntries(
      keys
        .map(key => [key, sensorData[key]])
        .filter(([_, value]) => value !== undefined && value !== null && !isNaN(value) && typeof value === 'number')
    );

    return Object.keys(payload).length > 0 ? { doc: { deviceId, payload } } : null;
  }

  async fetchMlSupport(deviceId, sensorData) {
    if (!this.mlSupportEnabled) return null;

    if (this.mlSupportCache.has(deviceId)) {
      const cached = this.mlSupportCache.get(deviceId);
      if (cached.fetched) return cached.result;
    }

    const body = this.buildMlPayload(deviceId, sensorData);
    if (!body) {
      this.mlSupportCache.set(deviceId, { fetched: true, result: null });
      return null;
    }

    const url = `${this.mlServiceUrl}/api/ml/predict/event/aggregate?compact=true&include_details=true`;
    let lastError = null;

    for (let attempt = 0; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.mlRequestTimeoutMs);

      try {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        
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
        const result = { device: data.device, predictions: data.details || {} };
        
        this.mlSupportCache.set(deviceId, { fetched: true, result });
        return result;

      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
        if (attempt < 2 && (error.name === 'AbortError' || error.message.includes('fetch failed'))) {
          continue;
        }
        break;
      }
    }
    
    if (lastError) logger.warn(`ML support request failed for ${deviceId}: ${lastError.message}`);
    this.mlSupportCache.set(deviceId, { fetched: true, result: null });
    return null;
  }

  attachMlMetadata(deviceId, sensorType, meta) {
    if (!this.mlMetadataCache.has(deviceId)) {
      this.mlMetadataCache.set(deviceId, {});
    }
    this.mlMetadataCache.get(deviceId)[sensorType] = {
      score: meta.score,
      alertLevel: meta.alertLevel,
      promoted: meta.promoted,
      thresholdMet: meta.thresholdMet,
      timestamp: Date.now()
    };
  }

  getMlMetadata(deviceId, sensorType) {
    return this.mlMetadataCache.get(deviceId)?.[sensorType] || null;
  }

  async evaluateMlAnomaly(deviceId, sensorData) {
    if (!this.mlSupportEnabled || !deviceId) return;

    try {
      const now = Date.now();
      const lastAlertTime = this.lastMlAlertTime.get(deviceId);
      if (lastAlertTime && (now - lastAlertTime) < this.mlAlertCooldown) return;

      const mlResult = await this.fetchMlSupport(deviceId, sensorData);
      if (!mlResult?.device) return;

      const { overall_score: deviceScore, alert_level: deviceAlertLevel, is_danger: isDanger, primary_cause: primarySensor } = mlResult.device;
      const shouldAlert = isDanger || (deviceScore >= this.mlSupportThreshold && ['high', 'critical'].includes(deviceAlertLevel));
      if (!shouldAlert || !sensorData.ownerId) return;

      const maxSensor = primarySensor || 'unknown';
      const sensorKeyMap = { gas_ppm: 'gas_ppm', gas: 'gas_ppm', temperature: 'temp', humidity: 'humid', smoke: 'smoke' };
      const maxSensorValue = mlResult.predictions?.[maxSensor]?.value ?? sensorData[sensorKeyMap[maxSensor] || maxSensor];

      const sensorNameMap = {
        temperature: 'Nhiệt độ', humidity: 'Độ ẩm', gas: 'Khí gas', gas_ppm: 'Khí gas', smoke: 'Khói', flame: 'Lửa'
      };
      const isCritical = deviceAlertLevel === 'critical';
      const alertLevelText = deviceAlertLevel === 'critical' ? 'RẤT NGUY HIỂM' : deviceAlertLevel === 'high' ? 'Cao' : 'Trung bình';

      await this.sendToAlertsService({
        userId: sensorData.ownerId,
        title: isCritical ? '🚨 CẢNH BÁO KHẨN CẤP: AI phát hiện nguy cơ cao!' : '⚠️ Cảnh báo thông minh: Phát hiện bất thường',
        message: `Hệ thống AI đã phát hiện mẫu dữ liệu bất thường.\n` +
                `Nguyên nhân chính: Cảm biến ${sensorNameMap[maxSensor] || maxSensor}\n\n` +
                `Giá trị đo được: ${maxSensorValue !== null && maxSensorValue !== undefined ? maxSensorValue : 'N/A'}\n` +
                `Điểm bất thường: ${(deviceScore * 100).toFixed(1)}%\n` +
                `Mức độ cảnh báo: ${alertLevelText}\n` +
                `Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
                `${isCritical ? '🚨 AI nhận định đây là sự cố nghiêm trọng. Kiểm tra ngay!' : '⚠️ Có dấu hiệu lạ, vui lòng để ý thiết bị.'}`,
        type: isCritical ? 'security_alert' : 'device_alert',
        category: isCritical ? 'security' : 'ml_anomaly',
        priority: isCritical ? 'urgent' : 'high',
        metadata: {
          deviceId,
          deviceName: `Device ${deviceId}`,
          source: 'ml_multivariate_isolation_forest',
          mlData: {
            overallScore: deviceScore,
            alertLevel: deviceAlertLevel,
            primaryCause: maxSensor,
            predictions: mlResult.predictions
          },
          sensorData
        }
      });

      this.lastMlAlertTime.set(deviceId, now);
    } catch (error) {
      logger.error('evaluateMlAnomaly error:', error);
    }
  }

}

export default RuleEvaluationService;
