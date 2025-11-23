import RuleTemplate from '../models/RuleTemplate.js';
import logger from '../utils/logger.js';

// Get all templates (admin only) - can filter by language, priority, isActive
export const getAllTemplatesAdmin = async (req, res) => {
  try {
    const { language, priority, isActive, limit = 100, page = 1 } = req.query;
    
    const query = { deletedAt: null };
    // Only filter by language if provided and not 'all'
    if (language && language !== 'all') {
      query.language = language;
    }
    if (priority) query.priority = priority;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const templates = await RuleTemplate.find(query)
      .sort({ language: 1, priority: 1, templateKey: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await RuleTemplate.countDocuments(query);
    
    res.json({
      success: true,
      data: templates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching all templates (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching templates',
      error: error.message
    });
  }
};

// Get template by key and language (admin)
export const getTemplateByIdAdmin = async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { language = 'vi' } = req.query;
    
    const template = await RuleTemplate.findOne({ templateKey, language, deletedAt: null });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Error fetching template (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching template',
      error: error.message
    });
  }
};

// Create template (admin)
export const createTemplateAdmin = async (req, res) => {
  try {
    const {
      templateKey,
      name,
      description,
      priority,
      cooldownPeriod,
      conditions,
      actions,
      language = 'vi',
      isActive = true
    } = req.body;
    
    if (!templateKey || !name || !conditions?.length || !actions?.length) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu các trường bắt buộc: templateKey, name, conditions, actions'
      });
    }
    
    // Check if template with same key and language already exists (not deleted)
    const existing = await RuleTemplate.findOne({ templateKey, language, deletedAt: null });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Mẫu quy tắc với key "${templateKey}" và ngôn ngữ "${language}" đã tồn tại`
      });
    }
    
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    const normalizedPriority = validPriorities.includes(priority) ? priority : 'medium';
    
    const template = new RuleTemplate({
      templateKey,
      name,
      description,
      priority: normalizedPriority,
      cooldownPeriod: cooldownPeriod || 300000,
      conditions,
      actions,
      language,
      isActive,
      createdBy: req.user.userId || req.user.sub
    });
    
    await template.save();
    
    logger.info('Template created by admin:', { 
      templateKey, 
      language, 
      createdBy: req.user.userId || req.user.sub 
    });
    
    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    logger.error('Error creating template (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error creating template',
      error: error.message
    });
  }
};

// Update template (admin)
export const updateTemplateAdmin = async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { language = 'vi' } = req.query;
    const { _id, createdAt, updatedAt, templateKey: bodyKey, ...updateData } = req.body;
    
    logger.debug('Updating template:', { templateKey, language, updateData });
    
    const template = await RuleTemplate.findOne({ templateKey, language, deletedAt: null });
    if (!template) {
      logger.warn('Template not found:', { templateKey, language });
      return res.status(404).json({
        success: false,
        message: `Template not found with key "${templateKey}" and language "${language}"`
      });
    }
    
    // Validate priority if provided
    if (updateData.priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(updateData.priority)) {
        updateData.priority = 'medium';
      }
    }
    
    // Validate isActive if provided
    if (updateData.isActive !== undefined && typeof updateData.isActive !== 'boolean') {
      updateData.isActive = Boolean(updateData.isActive);
    }
    
    updateData.updatedBy = req.user.userId || req.user.sub;
    
    const updatedTemplate = await RuleTemplate.findByIdAndUpdate(
      template._id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!updatedTemplate) {
      logger.error('Failed to update template:', { templateKey, language, templateId: template._id });
      return res.status(500).json({
        success: false,
        message: 'Failed to update template'
      });
    }
    
    logger.info('Template updated by admin:', { 
      templateKey, 
      language, 
      updatedBy: req.user.userId || req.user.sub,
      changes: updateData
    });
    
    res.json({
      success: true,
      data: updatedTemplate,
      message: 'Template updated successfully'
    });
  } catch (error) {
    logger.error('Error updating template (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error updating template',
      error: error.message
    });
  }
};

// Delete template (admin) - soft delete by setting deletedAt
export const deleteTemplateAdmin = async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { language = 'vi' } = req.query;
    
    const template = await RuleTemplate.findOne({ templateKey, language, deletedAt: null });
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Soft delete by setting deletedAt
    await template.softDelete();
    
    logger.info('Template deleted by admin:', { 
      templateKey, 
      language, 
      deletedBy: req.user.userId || req.user.sub 
    });
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting template (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting template',
      error: error.message
    });
  }
};

// Hard delete template (admin) - permanently remove from database
export const hardDeleteTemplateAdmin = async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { language = 'vi' } = req.query;
    
    const template = await RuleTemplate.findOneAndDelete({ templateKey, language });
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    logger.info('Template hard deleted by admin:', { 
      templateKey, 
      language, 
      deletedBy: req.user.userId || req.user.sub 
    });
    
    res.json({
      success: true,
      message: 'Template permanently deleted'
    });
  } catch (error) {
    logger.error('Error hard deleting template (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting template',
      error: error.message
    });
  }
};

