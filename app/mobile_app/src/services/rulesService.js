import environment from '../config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';

class RulesService {
  constructor() {
    this.baseURL = environment.getApiUrl('GATEWAY');
  }

  // Get authentication token from storage
  async getAuthToken() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get all rules for a user
  async getAllRules(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        ...params
      });
      
      const token = await this.getAuthToken();

      const response = await fetch(`${this.baseURL}/api/rules?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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


  // Create new rule
  async createRule(ruleData) {
    try {
      const token = await this.getAuthToken();     
      
      // Ensure deviceId is included in ruleData
      if (!ruleData.deviceId) {
        console.warn('⚠️ No deviceId in ruleData, this may cause issues');
      }
      
      console.log('📤 Creating rule with data:', JSON.stringify(ruleData, null, 2));

      const response = await fetch(`${this.baseURL}/api/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(ruleData),
      });

      const responseText = await response.text();

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

  // Create rule from template
  async createRuleFromTemplate(template, deviceId, customizations = {}) {
    try {
      console.log('createRuleFromTemplate called with:', { template, deviceId, customizations });
      
      // Validate required parameters
      if (!template) {
        throw new Error('Template is required');
      }
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      // Create rule data from template
      const ruleData = {
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        deviceId,
        priority: template.priority || 'medium',
        maxTriggersPerDay: template.maxTriggersPerDay || (template.priority === 'urgent' ? null : 10),
        cooldownPeriod: template.cooldownPeriod || (template.priority === 'urgent' ? null : 300000),
        isActive: true, // Always active by default when created from template
        conditions: template.conditions,
        conditionLogic: template.conditionLogic || 'AND',
        actions: template.actions,
        ...customizations
      };

      // Create the rule
      const result = await this.createRule(ruleData);
      console.log('Create rule result:', result);
      return result;
    } catch (error) {
      console.error('Error creating rule from template:', error);
      throw error;
    }
  }

  // Update rule
  async updateRule(ruleId, updateData) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Update rule result:', data);
      return data;
    } catch (error) {
      console.error('Error updating rule:', error);
      throw error;
    }
  }

  // Delete rule
  async deleteRule(ruleId) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Delete rule result:', data);
      return data;
    } catch (error) {
      console.error('Error deleting rule:', error);
      throw error;
    }
  }

  // Toggle rule status
  async toggleRuleStatus(ruleId, isActive) {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Toggle rule status result:', data);
      return data;
    } catch (error) {
      console.error('Error toggling rule status:', error);
      throw error;
    }
  }

  // Respond to an alert related to a rule (acknowledged | dismissed | false_alarm)
  async respondToAlert(ruleId, response, metadata = {}, timeoutMs = undefined) {
    try {
      if (!ruleId || !response) {
        throw new Error('ruleId and response are required');
      }
      const valid = ['acknowledged', 'dismissed', 'false_alarm'];
      if (!valid.includes(response)) {
        throw new Error('Invalid response type');
      }

      const token = await this.getAuthToken();
      const res = await fetch(`${this.baseURL}/api/rules/${ruleId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ response, metadata, ...(timeoutMs ? { timeoutMs } : {}) }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (error) {
      console.error('respondToAlert error:', error);
      throw error;
    }
  }
}

export default new RulesService();
