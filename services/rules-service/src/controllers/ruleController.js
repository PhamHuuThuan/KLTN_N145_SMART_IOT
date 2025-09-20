import Rule from '../models/Rule.js';
import mongoose from 'mongoose';

// Get all rules for a user
export const getAllRules = async (req, res) => {
  try {
    const { ownerId, deviceId, category, isActive, limit = 50, page = 1 } = req.query;
    
    let query = {};
    if (ownerId) {
      query.ownerId = mongoose.Types.ObjectId.isValid(ownerId)
        ? new mongoose.Types.ObjectId(ownerId)
        : ownerId;
    }
    if (deviceId) query.deviceId = deviceId;
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const rules = await Rule.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ priority: -1, createdAt: -1 });
    
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
    res.status(500).json({
      success: false,
      message: 'Error fetching rules',
      error: error.message
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
      ownerId,
      deviceId,
      category,
      priority,
      conditions,
      actions,
      cooldownPeriod,
      settings
    } = req.body;
    
    if (!name || !ownerId || !deviceId || !conditions || !actions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, ownerId, deviceId, conditions, actions'
      });
    }
    
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one condition is required'
      });
    }
    
    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one action is required'
      });
    }
    
    const rule = new Rule({
      name,
      description,
      ownerId,
      deviceId,
      category: category || 'automation',
      priority: priority || 5,
      conditions,
      actions,
      cooldownPeriod: cooldownPeriod || 30000,
      settings: settings || {}
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
    const updateData = req.body;
    
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.lastTriggeredAt;
    delete updateData.triggerCount;
    
    const rule = await Rule.findByIdAndUpdate(
      ruleId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    

    res.json({
      success: true,
      data: rule,
      message: 'Rule updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating rule',
      error: error.message
    });
  }
};

// Delete rule
export const deleteRule = async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const rule = await Rule.findByIdAndDelete(ruleId);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting rule',
      error: error.message
    });
  }
};

// Toggle rule active status
export const toggleRuleStatus = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { isActive } = req.body;

    const rule = await Rule.findByIdAndUpdate(
      ruleId,
      { isActive: !!isActive, updatedAt: new Date() },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }

    res.json({
      success: true,
      data: rule,
      message: `Rule ${rule.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating rule status', error: error.message });
  }
};

// Get rule templates (predefined rule configurations)
export const getRuleTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'temperature_high',
        name: 'High Temperature Alert',
        description: 'Alert when temperature exceeds threshold',
        category: 'safety',
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
            message: 'High temperature detected!',
            priority: 'high'
          }
        ]
      },
      {
        id: 'gas_leak_detection',
        name: 'Gas Leak Detection',
        description: 'Emergency response for gas leak',
        category: 'safety',
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
            type: 'activate_emergency',
            priority: 'critical'
          },
          {
            type: 'send_alert',
            message: 'Gas leak detected! Emergency mode activated.',
            priority: 'critical'
          }
        ]
      },
      {
        id: 'smoke_detection',
        name: 'Smoke Detection',
        description: 'Emergency response for smoke detection',
        category: 'safety',
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
            type: 'activate_emergency',
            priority: 'critical'
          },
          {
            type: 'send_alert',
            message: 'Smoke detected! Emergency mode activated.',
            priority: 'critical'
          }
        ]
      },
      {
        id: 'auto_outlet_off',
        name: 'Auto Turn Off Outlets',
        description: 'Automatically turn off kitchen outlets at night',
        category: 'energy_saving',
        conditions: [
          {
            type: 'time',
            timeCondition: {
              hour: 23,
              minute: 0,
              days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            }
          }
        ],
        actions: [
          {
            type: 'toggle_outlet',
            outletId: 'o1',
            status: false
          },
          {
            type: 'toggle_outlet',
            outletId: 'o2',
            status: false
          },
          {
            type: 'toggle_outlet',
            outletId: 'o3',
            status: false
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

// Get rules by device ID
export const getRulesByDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { ownerId, isActive } = req.query;

    const query = { deviceId };
    if (ownerId) {
      query.ownerId = mongoose.Types.ObjectId.isValid(ownerId)
        ? new mongoose.Types.ObjectId(ownerId)
        : ownerId;
    }
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const rules = await Rule.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    console.error('Error getting rules by device:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting rules by device',
      error: error.message
    });
  }
};

// Get rules by owner ID
export const getRulesByOwner = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { deviceId, category, isActive, page = 1, limit = 10 } = req.query;

    const query = { ownerId: mongoose.Types.ObjectId.isValid(ownerId)
      ? new mongoose.Types.ObjectId(ownerId)
      : ownerId };
    if (deviceId) query.deviceId = deviceId;
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const rules = await Rule.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rule.countDocuments(query);

    res.json({
      success: true,
      data: rules,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting rules by owner:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting rules by owner',
      error: error.message
    });
  }
};

// Get rule by ID
export const getRuleById = async (req, res) => {
  try {
    const { ruleId } = req.params;

    const rule = await Rule.findById(ruleId);
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
    console.error('Error getting rule by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting rule by ID',
      error: error.message
    });
  }
};

// Bulk create rules
export const createBulkRules = async (req, res) => {
  try {
    const { rules } = req.body;
    
    if (!Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'rules array is required and must not be empty'
      });
    }

    const createdRules = [];
    const errors = [];

    for (let i = 0; i < rules.length; i++) {
      try {
        const rule = new Rule(rules[i]);
        const savedRule = await rule.save();
        createdRules.push(savedRule);
      } catch (error) {
        errors.push({
          index: i,
          rule: rules[i].name || `Rule ${i + 1}`,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdRules.length} rules successfully`,
      data: {
        created: createdRules,
        errors: errors,
        total: rules.length,
        successCount: createdRules.length,
        errorCount: errors.length
      }
    });
  } catch (error) {
    console.error('Error creating bulk rules:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bulk rules',
      error: error.message
    });
  }
};

// Get rule statistics
export const getRuleStats = async (req, res) => {
  try {
    const { ownerId } = req.params;

    const stats = await Rule.aggregate([
      { $match: { ownerId: mongoose.Types.ObjectId.isValid(ownerId) ? new mongoose.Types.ObjectId(ownerId) : ownerId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactive: { $sum: { $cond: ['$isActive', 0, 1] } }
        }
      }
    ]);

    const categoryStats = await Rule.aggregate([
      { $match: { ownerId: mongoose.Types.ObjectId.isValid(ownerId) ? new mongoose.Types.ObjectId(ownerId) : ownerId } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPriority: { $avg: '$priority' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || { total: 0, active: 0, inactive: 0 },
        byCategory: categoryStats
      }
    });
  } catch (error) {
    console.error('Error getting rule stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting rule statistics',
      error: error.message
    });
  }
};
