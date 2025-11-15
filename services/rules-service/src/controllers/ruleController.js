import Rule from '../models/Rule.js';
import RuleEvaluationService from '../services/RuleEvaluationService.js';
import logger from '../utils/logger.js';

// Delegate messaging to RuleEvaluationService to reuse its Kafka producer
const ruleEvaluationService = new RuleEvaluationService();

// Get all rules for a user
export const getAllRules = async (req, res) => {
  try {
    const { deviceId, isActive, limit = 50, page = 1 } = req.query;
    const userId = req.user.userId;

    const options = { deviceId, isActive, limit: parseInt(limit), page: parseInt(page) };
    const rules = await Rule.findByCreator(userId, options);

    // Đếm tổng số rule
    const query = { createdBy: userId, deletedAt: null };
    if (deviceId) query.deviceId = deviceId;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    const total = await Rule.countDocuments(query);

    res.json({
      success: true,
      data: rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
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
    logger.debug('Create rule request body:', JSON.stringify(req.body, null, 2));
    logger.debug('User info:', JSON.stringify(req.user, null, 2));
    
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
    
    const createdBy = (req.user && (req.user.userId || req.user.sub || req.user.id)) || null;
    logger.debug('Extracted createdBy:', createdBy);

    if (!name || !deviceId || !conditions?.length || !actions?.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, deviceId, conditions, actions'
      });
    }

    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: 'User authentication required to create rule'
      });
    }

    // Chỉ cho phép giá trị enum hợp lệ
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const normalizedPriority = validPriorities.includes(priority) ? priority : 'medium';

    const rule = new Rule({
      name,
      description,
      createdBy,
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

    // Ensure ruleId is generated
    if (!rule.ruleId) {
      rule.ruleId = Rule.generateRuleId();
      await rule.save();
    }

    logger.info('Rule created successfully:', { ruleId: rule.ruleId, name: rule.name });
    res.status(201).json({
      success: true,
      data: rule,
      message: 'Rule created successfully'
    });
  } catch (error) {
    logger.error('Error creating rule:', error);
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
    const { _id, createdAt, updatedAt, createdBy, ...updateData } = req.body;

    // Kiểm tra rule thuộc quyền user và chưa bị soft delete
    const rule = await Rule.findOne({ _id: ruleId, createdBy: req.user.userId, deletedAt: null });
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

// Delete rule (soft delete)
export const deleteRule = async (req, res) => {
  try {
    const { ruleId } = req.params;

    // Tìm rule thuộc quyền sở hữu user
    const rule = await Rule.findOne({
      _id: ruleId,
      createdBy: req.user.userId,
      deletedAt: null // Chỉ tìm rule chưa bị xóa mềm
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found or access denied',
      });
    }

    // Soft delete rule
    await rule.softDelete();

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

    // Cập nhật rule chỉ khi thuộc về user và chưa bị soft delete
    const updatedRule = await Rule.findOneAndUpdate(
      { _id: ruleId, createdBy: req.user.userId, deletedAt: null },
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
    const { response, metadata = {} } = req.body || {};
    const userId = req.user?.userId || req.user?.sub;

    const result = await ruleEvaluationService.handleUserResponse({
      userId,
      ruleId,
      response,
      metadata
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
