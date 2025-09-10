import environment from '../config/environment';

class RulesService {
  constructor() {
    this.baseURL = environment.getApiUrl('RULES_SERVICE');
  }

  // Get all rules for a user
  async getAllRules(ownerId, params = {}) {
    try {
      const queryParams = new URLSearchParams({
        ownerId,
        ...params
      });
      
      console.log('Fetching rules from:', `${this.baseURL}/api/rules?${queryParams}`);
      
      const response = await fetch(`${this.baseURL}/api/rules?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Rules API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Rules API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Rules API response data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching rules:', error);
      throw error;
    }
  }

  // Get rule templates
  async getRuleTemplates() {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/templates`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching rule templates:', error);
      throw error;
    }
  }

  // Get rule by ID
  async getRuleById(ruleId) {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching rule:', error);
      throw error;
    }
  }

  // Create new rule
  async createRule(ruleData) {
    try {
      console.log('Creating rule with data:', ruleData);
      console.log('API URL:', `${this.baseURL}/api/rules`);
      
      const response = await fetch(`${this.baseURL}/api/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ruleData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      console.log('Parsed response data:', data);
      return data;
    } catch (error) {
      console.error('Error creating rule:', error);
      throw error;
    }
  }

  // Update rule
  async updateRule(ruleId, updateData) {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating rule:', error);
      throw error;
    }
  }

  // Delete rule
  async deleteRule(ruleId) {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting rule:', error);
      throw error;
    }
  }

  // Toggle rule status
  async toggleRuleStatus(ruleId, isActive) {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling rule status:', error);
      throw error;
    }
  }

  // Get rules for a specific device
  async getDeviceRules(deviceId, isActive = true) {
    try {
      const queryParams = new URLSearchParams({
        isActive: isActive.toString()
      });
      
      const response = await fetch(`${this.baseURL}/api/rules/device/${deviceId}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching device rules:', error);
      throw error;
    }
  }

  // Get rule execution history
  async getRuleExecutions(ruleId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params);
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}/executions?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching rule executions:', error);
      throw error;
    }
  }

  // Get rule statistics
  async getRuleStats(ruleId, days = 7) {
    try {
      const queryParams = new URLSearchParams({
        days: days.toString()
      });
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}/stats?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching rule stats:', error);
      throw error;
    }
  }

  // Test rule conditions
  async testRuleConditions(ruleId, sensorData, deviceData) {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sensorData,
          deviceData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error testing rule conditions:', error);
      throw error;
    }
  }

  // Bulk update rules
  async bulkUpdateRules(ruleIds, updateData) {
    try {
      const response = await fetch(`${this.baseURL}/api/rules/bulk/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ruleIds,
          updateData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error bulk updating rules:', error);
      throw error;
    }
  }

  // Create rule from template
  async createRuleFromTemplate(templateId, ownerId, deviceId, customizations = {}) {
    try {
      console.log('createRuleFromTemplate called with:', { templateId, ownerId, deviceId, customizations });
      
      // Validate required parameters
      if (!templateId) {
        throw new Error('Template ID is required');
      }
      if (!ownerId) {
        throw new Error('Owner ID is required');
      }
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      // First get the template
      console.log('Fetching templates...');
      const templatesResponse = await this.getRuleTemplates();
      console.log('Templates response:', templatesResponse);
      
      if (!templatesResponse.success) {
        throw new Error('Failed to fetch templates');
      }
      
      const template = templatesResponse.data.find(t => t.id === templateId);
      console.log('Found template:', template);
      
      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Create rule data from template
      const ruleData = {
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        ownerId,
        deviceId,
        category: template.category,
        conditions: template.conditions,
        actions: template.actions,
        ...customizations
      };

      console.log('Rule data to create:', ruleData);

      // Create the rule
      const result = await this.createRule(ruleData);
      console.log('Create rule result:', result);
      return result;
    } catch (error) {
      console.error('Error creating rule from template:', error);
      throw error;
    }
  }

  // Get rules by category
  async getRulesByCategory(ownerId, category) {
    try {
      return await this.getAllRules(ownerId, { category });
    } catch (error) {
      console.error('Error fetching rules by category:', error);
      throw error;
    }
  }

  // Get active rules only
  async getActiveRules(ownerId) {
    try {
      return await this.getAllRules(ownerId, { isActive: true });
    } catch (error) {
      console.error('Error fetching active rules:', error);
      throw error;
    }
  }

  // Get inactive rules only
  async getInactiveRules(ownerId) {
    try {
      return await this.getAllRules(ownerId, { isActive: false });
    } catch (error) {
      console.error('Error fetching inactive rules:', error);
      throw error;
    }
  }
}

export default new RulesService();
