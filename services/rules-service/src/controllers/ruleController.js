import Rule from '../models/Rule.js';
import RuleEvaluationService from '../services/RuleEvaluationService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ruleController');

// Delegate messaging to RuleEvaluationService to reuse its Kafka producer
const ruleEvaluationService = new RuleEvaluationService();

// Get all rules for a user
export const getAllRules = async (req, res) => {
  try {
    const { deviceId, isActive, limit = 50, page = 1 } = req.query;
    const ownerId = req.user.userId;

    const query = { ownerId };
    if (deviceId) query.deviceId = deviceId;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const numericLimit = parseInt(limit);
    const numericPage = parseInt(page);

    // Lấy danh sách rule
    const rules = await Rule.find(query)
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit);

    // Sắp xếp lại theo priority: urgent → high → medium → low
    const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];
    rules.sort(
      (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
    );

    // Đếm tổng số rule
    const total = await Rule.countDocuments(query);

    res.json({
      success: true,
      data: rules,
      pagination: {
        page: numericPage,
        limit: numericLimit,
        total,
        pages: Math.ceil(total / numericLimit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching rules',
      error: error.message,
    });
  }
};

// Create new rule
export const createRule = async (req, res) => {
  try {
    console.log('Create rule request body:', JSON.stringify(req.body, null, 2));
    
    const { name, description, deviceId, priority, conditions, actions } = req.body;
    const ownerId = (req.user && (req.user.userId || req.user.sub || req.user.id)) || null;

    if (!name || !deviceId || !conditions?.length || !actions?.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, deviceId, conditions, actions'
      });
    }

    // Chỉ cho phép giá trị enum hợp lệ
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const normalizedPriority = validPriorities.includes(priority) ? priority : 'medium';

    const rule = new Rule({
      name,
      description,
      ownerId,
      deviceId,
      priority: normalizedPriority,
      conditions,
      actions
    });

    await rule.save();

    res.status(201).json({
      success: true,
      data: rule,
      message: 'Rule created successfully'
    });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating rule',
      error: error.message
    });
  }
};

// Update rule
export const updateRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { _id, createdAt, updatedAt, ownerId, ...updateData } = req.body;

    // Kiểm tra rule thuộc quyền user
    const rule = await Rule.findOne({ _id: ruleId, ownerId: req.user.userId });
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found or access denied',
      });
    }

    // Cập nhật rule
    const updatedRule = await Rule.findByIdAndUpdate(
      ruleId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedRule,
      message: 'Rule updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating rule',
      error: error.message,
    });
  }
};

// Delete rule
export const deleteRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    // Xóa rule nếu thuộc quyền sở hữu user
    const deletedRule = await Rule.findOneAndDelete({
      _id: ruleId,
      ownerId: req.user.userId
    });

    if (!deletedRule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting rule',
      error: error.message,
    });
  }
};

// Toggle rule active status
export const toggleRuleStatus = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { isActive } = req.body;

    // Cập nhật rule chỉ khi thuộc về user
    const updatedRule = await Rule.findOneAndUpdate(
      { _id: ruleId, ownerId: req.user.userId },
      { isActive: !!isActive, updatedAt: new Date() },
      { new: true }
    );

    if (!updatedRule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found or access denied',
      });
    }

    res.json({
      success: true,
      data: updatedRule,
      message: `Rule ${updatedRule.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating rule status',
      error: error.message,
    });
  }
};

// Get rule templates (predefined rule configurations)
export const getRuleTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'gas_leak_detection',
        name: 'Gas Leak Detection',
        description: 'Emergency response for gas leak',
        priority: 'urgent',
        isActive: true,
        cooldownPeriod: null,  // No cooldown for gas emergency
        maxTriggersPerDay: null,  // Unlimited for gas emergency
        duration: 0,  // Immediate trigger
        conditions: [
          {
            type: 'sensor',
            sensor: 'gas_ppm',
            operator: '>',
            value: 1000
          }
        ],
        actions: [
          {
            type: 'send_alert',
            message: '🚨 Gas leak detected! Current level: {sensorValue} ppm (Threshold: {threshold} ppm). Emergency mode activated - evacuate immediately!'
          }
        ]
      },
      {
        id: 'smoke_detection',
        name: 'Smoke Detection',
        description: 'Emergency response for smoke detection',
        priority: 'high',
        isActive: true,
        cooldownPeriod: 300000,  // 5 minutes cooldown
        maxTriggersPerDay: 20,  // 20 times per day
        duration: 30000,  // 30 seconds duration
        conditions: [
          {
            type: 'sensor',
            sensor: 'smoke',
            operator: '==',
            value: 1
          }
        ],
        actions: [
          {
            type: 'send_notification',
            message: '⚠️ Smoke detected! Level: {sensorValue} (Threshold: {threshold}). Please check if it\'s from cooking or if there\'s a real fire. Location: {deviceId}'
          }
        ]
      },
      {
        id: 'temperature_high',
        name: 'High Temperature Alert',
        description: 'Alert when temperature exceeds threshold',
        priority: 'high',
        isActive: true,
        cooldownPeriod: 300000,  // 5 minutes
        maxTriggersPerDay: 20,  // 20 times per day
        duration: 300000,  // 5 minutes duration
        conditions: [
          {
            type: 'sensor',
            sensor: 'temperature',
            operator: '>',
            value: 40
          }
        ],
        actions: [
          {
            type: 'send_notification',
            message: '🌡️ High temperature detected! Current: {sensorValue}°C (Threshold: {threshold}°C). Check ventilation and cooling systems. Device: {deviceId}'
          }
        ]
      },
      {
        id: 'humidity_high',
        name: 'High Humidity Alert',
        description: 'Alert when humidity exceeds comfortable level',
        priority: 'medium',
        isActive: true,
        cooldownPeriod: 600000,  // 10 minutes
        maxTriggersPerDay: 10,  // 10 times per day
        duration: 600000,  // 10 minutes duration
        conditions: [
          {
            type: 'sensor',
            sensor: 'humidity',
            operator: '>',
            value: 80
          }
        ],
        actions: [
          {
            type: 'send_notification',
            message: '💧 High humidity detected! Current: {sensorValue}% (Threshold: {threshold}%). Consider ventilation or dehumidifier. Device: {deviceId}'
          }
        ]
      }
    ];
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching rule templates',
      error: error.message
    });
  }
};

// User responds to an alert (acknowledge, dismiss, false alarm)
export const respondToAlert = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { response, metadata = {}, timeoutMs } = req.body || {};
    const userId = req.user?.userId || req.user?.sub;

    const result = await ruleEvaluationService.handleUserResponse({
      userId,
      ruleId,
      response,
      metadata,
      timeoutMs
    });

    res.json({
      success: true,
      message: `Response '${response}' recorded successfully`,
      data: result
    });

  } catch (error) {
    logger.error('Error handling user response:', error);
    const status = error.statusCode || (error.message?.includes('Unauthorized') ? 401 : 500);
    res.status(status).json({
      success: false,
      message: 'Failed to process user response',
      error: error.message
    });
  }
};
