import Rule from '../models/Rule.js';
import logger from '../utils/logger.js';

// Get all rules (admin only) - can filter by deviceId, createdBy, isActive
export const getAllRulesAdmin = async (req, res) => {
  try {
    const { deviceId, createdBy, isActive, limit = 50, page = 1 } = req.query;
    
    const query = { deletedAt: null };
    if (deviceId) query.deviceId = deviceId;
    if (createdBy) query.createdBy = createdBy;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const rules = await Rule.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Rule.countDocuments(query);
    
    res.json({
      success: true,
      data: rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching all rules (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rules',
      error: error.message
    });
  }
};

// Get rule by ID (admin can access any rule)
export const getRuleByIdAdmin = async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const rule = await Rule.findOne({ _id: ruleId, deletedAt: null });
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    logger.error('Error fetching rule (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rule',
      error: error.message
    });
  }
};

// Create rule for any user/device (admin)
export const createRuleAdmin = async (req, res) => {
  try {
    const {
      name,
      description,
      deviceId,
      createdBy, // Admin can specify which user owns this rule
      priority,
      conditions,
      actions,
      cooldownPeriod,
      isActive
    } = req.body;
    
    if (!name || !deviceId || !conditions?.length || !actions?.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, deviceId, conditions, actions'
      });
    }
    
    // If createdBy not provided, use admin's userId
    const ruleOwner = createdBy || req.user.userId || req.user.sub;
    
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const normalizedPriority = validPriorities.includes(priority) ? priority : 'medium';
    
    const rule = new Rule({
      name,
      description,
      createdBy: ruleOwner,
      deviceId,
      priority: normalizedPriority,
      conditions,
      actions,
      cooldownPeriod: cooldownPeriod || 300000,
      isActive: isActive !== undefined ? isActive : true,
      triggerCount: 0,
      dailyTriggerCount: 0
    });
    
    await rule.save();
    
    if (!rule.ruleId) {
      rule.ruleId = Rule.generateRuleId();
      await rule.save();
    }
    
    logger.info('Rule created by admin:', { ruleId: rule.ruleId, name: rule.name, createdBy: ruleOwner });
    
    res.status(201).json({
      success: true,
      data: rule,
      message: 'Rule created successfully'
    });
  } catch (error) {
    logger.error('Error creating rule (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error creating rule',
      error: error.message
    });
  }
};

// Update any rule (admin)
export const updateRuleAdmin = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { _id, createdAt, updatedAt, createdBy, ...updateData } = req.body;
    
    const rule = await Rule.findOne({ _id: ruleId, deletedAt: null });
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    // Admin can change createdBy to transfer rule ownership
    if (createdBy) {
      updateData.createdBy = createdBy;
    }
    
    const updatedRule = await Rule.findByIdAndUpdate(
      ruleId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    logger.info('Rule updated by admin:', { ruleId, updatedBy: req.user.userId || req.user.sub });
    
    res.json({
      success: true,
      data: updatedRule,
      message: 'Rule updated successfully'
    });
  } catch (error) {
    logger.error('Error updating rule (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error updating rule',
      error: error.message
    });
  }
};

// Delete any rule (admin)
export const deleteRuleAdmin = async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const rule = await Rule.findOne({ _id: ruleId, deletedAt: null });
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    await rule.softDelete();
    
    logger.info('Rule deleted by admin:', { ruleId, deletedBy: req.user.userId || req.user.sub });
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting rule (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting rule',
      error: error.message
    });
  }
};

// Get rules statistics (admin)
export const getRulesStatsAdmin = async (req, res) => {
  try {
    const totalRules = await Rule.countDocuments({ deletedAt: null });
    const activeRules = await Rule.countDocuments({ deletedAt: null, isActive: true });
    const inactiveRules = await Rule.countDocuments({ deletedAt: null, isActive: false });
    
    const rulesByPriority = await Rule.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    
    const rulesByDevice = await Rule.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$deviceId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      data: {
        total: totalRules,
        active: activeRules,
        inactive: inactiveRules,
        byPriority: rulesByPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topDevices: rulesByDevice
      }
    });
  } catch (error) {
    logger.error('Error fetching rules stats (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};
