export const validateRule = (req, res, next) => {
  const { name, deviceId, conditions, actions, cooldownPeriod, maxTriggersPerDay } = req.body || {};
  
  // Required fields
  if (!name || !deviceId || !Array.isArray(conditions) || !Array.isArray(actions) || conditions.length === 0 || actions.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields: name, deviceId, conditions, actions' });
  }
  
  // Validate cooldownPeriod
  if (cooldownPeriod !== undefined) {
    if (typeof cooldownPeriod !== 'number' || cooldownPeriod < 0 || cooldownPeriod > 86400000) {
      return res.status(400).json({ success: false, message: 'cooldownPeriod must be a number between 0 and 86400000 (24 hours in ms)' });
    }
  }
  
  // Validate maxTriggersPerDay
  if (maxTriggersPerDay !== undefined) {
    if (typeof maxTriggersPerDay !== 'number' || maxTriggersPerDay < 1 || maxTriggersPerDay > 1000) {
      return res.status(400).json({ success: false, message: 'maxTriggersPerDay must be a number between 1 and 1000' });
    }
  }
  
  next();
};

export const validateRuleUpdate = (req, res, next) => {
  const { name, deviceId, conditions, actions, priority, pausedUntil, cooldownPeriod, maxTriggersPerDay } = req.body || {};
  
  // Check if any valid fields are provided
  if (
    name === undefined && deviceId === undefined &&
    conditions === undefined && actions === undefined && priority === undefined && 
    pausedUntil === undefined && cooldownPeriod === undefined && maxTriggersPerDay === undefined
  ) {
    return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
  }
  
  // Validate cooldownPeriod if provided
  if (cooldownPeriod !== undefined) {
    if (typeof cooldownPeriod !== 'number' || cooldownPeriod < 0 || cooldownPeriod > 86400000) {
      return res.status(400).json({ success: false, message: 'cooldownPeriod must be a number between 0 and 86400000 (24 hours in ms)' });
    }
  }
  
  // Validate maxTriggersPerDay if provided
  if (maxTriggersPerDay !== undefined) {
    if (typeof maxTriggersPerDay !== 'number' || maxTriggersPerDay < 1 || maxTriggersPerDay > 1000) {
      return res.status(400).json({ success: false, message: 'maxTriggersPerDay must be a number between 1 and 1000' });
    }
  }
  
  next();
};

export const validateRuleStatus = (req, res, next) => {
  const { isActive } = req.body || {};
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean value' });
  }
  next();
};
