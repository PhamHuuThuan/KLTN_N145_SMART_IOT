import environment from '../config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';

class RulesService {
  constructor() {
    this.baseURL = environment.getApiUrl('GATEWAY');
    this.log = createLogger('RulesService');
  }

  // Get authentication token from storage
  async getAuthToken() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || token === 'null' || token === 'undefined') {
        this.log.warn('Invalid token from AsyncStorage, user may need to login again');
        return null;
      }
      this.log.debug('Token retrieved from AsyncStorage');
      return token;
    } catch (error) {
      this.log.error('Error getting auth token:', error);
      return null;
    }
  }


  // Get all rules for a user
  async getAllRules(params = {}, token = null) {
    try {
      const queryParams = new URLSearchParams({
        ...params
      });
      
      const authToken = token || await this.getAuthToken();
      
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${this.baseURL}/api/rules?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      this.log.debug('Rules API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        this.log.error('Rules API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.log.debug('Rules loaded successfully:', data?.data?.length || 0, 'rules');
      return data;
    } catch (error) {
      this.log.error('Error fetching rules:', error);
      throw error;
    }
  }


  // Create new rule
  async createRule(ruleData, token = null) {
    try {
      // Use provided token or get from storage
      const authToken = token || await this.getAuthToken();
      
      if (!authToken) {
        throw new Error('No authentication token available');
      }
      
      if (!ruleData.deviceId) {
        this.log.warn('No deviceId in ruleData, this may cause issues');
      }
      
      this.log.info('Creating rule:', ruleData.name);

      const response = await fetch(`${this.baseURL}/api/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(ruleData),
      });

      const responseText = await response.text();
      this.log.debug('Create rule response:', response.status);

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
      this.log.info('Rule created successfully:', data?.data?.name || 'Unknown');
      return data;
    } catch (error) {
      this.log.error('Error creating rule:', error);
      throw error;
    }
  }

  // Create rule from template
  async createRuleFromTemplate(template, deviceId, customizations = {}, token = null) {
    try {
      this.log.info('Creating rule from template:', template.name);
      
      if (!template) {
        throw new Error('Template is required');
      }
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      const ruleData = {
        name: customizations.name || template.name,
        description: customizations.description || template.description,
        deviceId,
        priority: template.priority || 'medium',
        cooldownPeriod: template.cooldownPeriod || (template.priority === 'urgent' ? null : 300000),
        isActive: true,
        conditions: template.conditions,
        actions: template.actions,
        ...customizations
      };

      const result = await this.createRule(ruleData, token);
      return result;
    } catch (error) {
      this.log.error('Error creating rule from template:', error);
      throw error;
    }
  }

  // Update rule
  async updateRule(ruleId, updateData, token = null) {
    try {
      const authToken = token || await this.getAuthToken();
      
      const sanitizedUpdate = { ...updateData };
      delete sanitizedUpdate.pausedUntil;

      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(sanitizedUpdate),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.log.info('Rule updated successfully');
      return data;
    } catch (error) {
      this.log.error('Error updating rule:', error);
      throw error;
    }
  }

  // Delete rule
  async deleteRule(ruleId, token = null) {
    try {
      const authToken = token || await this.getAuthToken();
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.log.info('Rule deleted successfully');
      return data;
    } catch (error) {
      this.log.error('Error deleting rule:', error);
      throw error;
    }
  }

  // Toggle rule status
  async toggleRuleStatus(ruleId, isActive, token = null) {
    try {
      const authToken = token || await this.getAuthToken();
      
      const response = await fetch(`${this.baseURL}/api/rules/${ruleId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.log.info('Rule status toggled successfully');
      return data;
    } catch (error) {
      this.log.error('Error toggling rule status:', error);
      throw error;
    }
  }

  // Get all templates (public endpoint, no auth required)
  async getTemplates(language = 'vi') {
    try {
      this.log.info('Fetching templates from API, language:', language);
      
      const response = await fetch(`${this.baseURL}/api/templates?language=${language}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.log.error('Templates API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.log.debug('Templates loaded successfully:', Object.keys(data?.data || {}).length, 'templates');
      return data;
    } catch (error) {
      this.log.error('Error fetching templates:', error);
      throw error;
    }
  }

  // Get template by key (public endpoint, no auth required)
  async getTemplateByKey(templateKey, language = 'vi') {
    try {
      const response = await fetch(`${this.baseURL}/api/templates/${templateKey}?language=${language}`, {
        method: 'GET',
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
      this.log.error('Error fetching template:', error);
      throw error;
    }
  }

}

export default new RulesService();
