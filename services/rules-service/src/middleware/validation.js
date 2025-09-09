export const validateRule = (req, res, next) => {
  const { name, ownerId, deviceId, conditions, actions } = req.body || {};
  if (!name || !ownerId || !deviceId || !Array.isArray(conditions) || !Array.isArray(actions) || conditions.length === 0 || actions.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields: name, ownerId, deviceId, conditions, actions' });
  }
  next();
};

export const validateRuleUpdate = (req, res, next) => {
  const { name, ownerId, deviceId, conditions, actions, priority, category, cooldownPeriod, settings } = req.body || {};
  if (
    name === undefined && ownerId === undefined && deviceId === undefined &&
    conditions === undefined && actions === undefined && priority === undefined &&
    category === undefined && cooldownPeriod === undefined && settings === undefined
  ) {
    return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
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
