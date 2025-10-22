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
    
    const { 
      name, 
      description, 
      deviceId, 
      priority, 
      conditions, 
      actions,
      cooldownPeriod,
      maxTriggersPerDay,
      isActive,
      conditionLogic
    } = req.body;
    
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
      actions,
      cooldownPeriod: cooldownPeriod || 300000,
      maxTriggersPerDay: maxTriggersPerDay || 10,
      isActive: isActive !== undefined ? isActive : true,
      conditionLogic: conditionLogic || 'AND'
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
