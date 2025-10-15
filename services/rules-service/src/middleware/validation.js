export const validateRule = (req, res, next) => {
  const { name, ownerId, deviceId, conditions, actions, cooldownPeriod, maxTriggersPerDay, duration } = req.body || {};
  
  // Required fields
  if (!name || !ownerId || !deviceId || !Array.isArray(conditions) || !Array.isArray(actions) || conditions.length === 0 || actions.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields: name, ownerId, deviceId, conditions, actions' });
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
  
  // Validate duration
  if (duration !== undefined) {
    if (typeof duration !== 'number' || duration < 0 || duration > 3600000) {
      return res.status(400).json({ success: false, message: 'duration must be a number between 0 and 3600000 (1 hour in ms)' });
    }
  }
  
  next();
};

export const validateRuleUpdate = (req, res, next) => {
  const { name, ownerId, deviceId, conditions, actions, priority, pausedUntil, cooldownPeriod, maxTriggersPerDay, duration } = req.body || {};
  
  // Check if any valid fields are provided
  if (
    name === undefined && ownerId === undefined && deviceId === undefined &&
    conditions === undefined && actions === undefined && priority === undefined && 
    pausedUntil === undefined && cooldownPeriod === undefined && maxTriggersPerDay === undefined && duration === undefined
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
  
  // Validate duration if provided
  if (duration !== undefined) {
    if (typeof duration !== 'number' || duration < 0 || duration > 3600000) {
      return res.status(400).json({ success: false, message: 'duration must be a number between 0 and 3600000 (1 hour in ms)' });
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

export const validateBulkUpdate = (req, res, next) => {
  return res.status(400).json({ success: false, message: 'Bulk update disabled in minimal service' });
};
