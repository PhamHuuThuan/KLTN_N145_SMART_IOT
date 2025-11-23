import api from '../utils/api';

class TemplatesService {
  // Get all templates (admin endpoint)
  async getAllTemplates(params = {}) {
    try {
      const response = await api.get('/api/admin/templates/all', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  // Get template by key and language
  async getTemplateByKey(templateKey, language = 'vi') {
    try {
      const response = await api.get(`/api/admin/templates/${templateKey}`, {
        params: { language }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching template:', error);
      throw error;
    }
  }

  // Create new template
  async createTemplate(templateData) {
    try {
      const response = await api.post('/api/admin/templates', templateData);
      return response.data;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  // Update template
  async updateTemplate(templateKey, language, templateData) {
    try {
      const response = await api.patch(`/api/admin/templates/${templateKey}?language=${language}`, templateData);
      return response.data;
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  // Delete template (hard delete)
  async deleteTemplate(templateKey, language) {
    try {
      const response = await api.delete(`/api/admin/templates/${templateKey}/hard`, {
        params: { language }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  // Toggle template status
  async toggleTemplateStatus(templateKey, language, isActive) {
    try {
      const response = await api.patch(`/api/admin/templates/${templateKey}?language=${language}`, { isActive });
      return response.data;
    } catch (error) {
      console.error('Error toggling template status:', error);
      throw error;
    }
  }
}

export default new TemplatesService();
