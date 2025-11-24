import RuleTemplate from '../models/RuleTemplate.js';
import logger from '../utils/logger.js';

// Get all active templates by language (public endpoint for mobile app)
export const getTemplates = async (req, res) => {
  try {
    const { language = 'vi' } = req.query;
    
    const templates = await RuleTemplate.getByLanguage(language);
    
    // Convert to object format like the old hardcoded templates
    const templatesObject = {};
    templates.forEach(template => {
      templatesObject[template.templateKey] = {
        name: template.name,
        description: template.description,
        priority: template.priority,
        cooldownPeriod: template.cooldownPeriod,
        conditions: template.conditions,
        actions: template.actions,
        id: template.templateKey,
        key: template.templateKey
      };
    });
    
    res.json({
      success: true,
      data: templatesObject
    });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching templates',
      error: error.message
    });
  }
};

// Get template by key (public endpoint for mobile app)
export const getTemplateByKey = async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { language = 'vi' } = req.query;
    
    const template = await RuleTemplate.getByKey(templateKey, language);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        name: template.name,
        description: template.description,
        priority: template.priority,
        cooldownPeriod: template.cooldownPeriod,
        conditions: template.conditions,
        actions: template.actions,
        id: template.templateKey,
        key: template.templateKey
      }
    });
  } catch (error) {
    logger.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching template',
      error: error.message
    });
  }
};
