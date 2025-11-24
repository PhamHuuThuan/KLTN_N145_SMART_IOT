import api from '../utils/api';

class RulesService {
  // Get all rules (admin endpoint)
  async getAllRules(params = {}) {
    try {
      const response = await api.get('/api/admin/rules/all', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching rules:', error);
      throw error;
    }
  }

  // Get rule stats
  async getRulesStats() {
    try {
      const response = await api.get('/api/admin/rules/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching rules stats:', error);
      throw error;
    }
  }

  // Get rule by ID
  async getRuleById(ruleId) {
    try {
      const response = await api.get(`/api/admin/rules/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching rule:', error);
      throw error;
    }
  }

  // Create new rule
  async createRule(ruleData) {
    try {
      const response = await api.post('/api/admin/rules', ruleData);
      return response.data;
    } catch (error) {
      console.error('Error creating rule:', error);
      throw error;
    }
  }

  // Update rule
  async updateRule(ruleId, ruleData) {
    try {
      const response = await api.patch(`/api/admin/rules/${ruleId}`, ruleData);
      return response.data;
    } catch (error) {
      console.error('Error updating rule:', error);
      throw error;
    }
  }

  // Delete rule
  async deleteRule(ruleId) {
    try {
      const response = await api.delete(`/api/admin/rules/${ruleId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting rule:', error);
      throw error;
    }
  }

  // Toggle rule status
  async toggleRuleStatus(ruleId, isActive) {
    try {
      const response = await api.patch(`/api/admin/rules/${ruleId}`, { isActive });
      return response.data;
    } catch (error) {
      console.error('Error toggling rule status:', error);
      throw error;
    }
  }
}

export default new RulesService();
