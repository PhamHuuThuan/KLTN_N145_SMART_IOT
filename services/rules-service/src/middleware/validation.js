
export const validateRuleUpdate = (req, res, next) => {
  const { name, deviceId, conditions, actions, priority, cooldownPeriod, isActive } = req.body || {};
  
  // Check if any valid fields are provided
  if (
    name === undefined && deviceId === undefined &&
    conditions === undefined && actions === undefined && priority === undefined && 
    cooldownPeriod === undefined && isActive === undefined
  ) {
    return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
  }

  // Validate isActive if provided
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean value' });
  }
  
  // Validate cooldownPeriod if provided
  if (cooldownPeriod !== undefined) {
    if (typeof cooldownPeriod !== 'number' || cooldownPeriod < 0 || cooldownPeriod > 86400000) {
      return res.status(400).json({ success: false, message: 'cooldownPeriod must be a number between 0 and 86400000 (24 hours in ms)' });
    }
  }

  if (conditions !== undefined) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ success: false, message: 'conditions must be a non-empty array' });
    }

    const hasInvalidCondition = conditions.some(condition => {
      if (!condition || condition.type !== 'sensor') return true;
      if (!condition.sensor) return true;
      if (!condition.operator) return true;
      return condition.value === undefined || condition.value === null;
    });

    if (hasInvalidCondition) {
      return res.status(400).json({ success: false, message: 'each condition must include sensor, operator, and value' });
    }
  }

  if (actions !== undefined) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ success: false, message: 'actions must be a non-empty array' });
    }

    const hasInvalidAction = actions.some(action => {
      if (!action || !action.type) return true;
      return !['send_notification', 'send_alert'].includes(action.type);
    });

    if (hasInvalidAction) {
      return res.status(400).json({ success: false, message: 'each action must include a valid type' });
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
