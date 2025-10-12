import { useState } from 'react';
import { Alert } from 'react-native';
import rulesService from '../services/rulesService';

export const useRuleActions = (loadRules) => {
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState(null);

  const toggleRuleStatus = async (ruleId, currentStatus) => {
    try {
      const response = await rulesService.toggleRuleStatus(ruleId, !currentStatus);
      if (response.success) {
        await loadRules();
      }
    } catch (error) {
      console.error('Error toggling rule status:', error);
    }
  };

  const deleteRule = async (ruleId, ruleName) => {
    Alert.alert(
      'Delete Rule',
      `Are you sure you want to delete "${ruleName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await rulesService.deleteRule(ruleId);
              if (response.success) {
                await loadRules();
              }
            } catch (error) {
              console.error('Error deleting rule:', error);
            }
          }
        }
      ]
    );
  };

  const createRuleFromTemplate = async (template, user, selectedDevice, overrides = {}) => {
    if (creatingTemplateId) return;
    
    try {
      setCreatingRule(true);
      setCreatingTemplateId(template.id);
      
      if (!user?.id) {
        console.error('User ID is required to create a rule');
        return;
      }
      if (!selectedDevice) {
        console.error('Device selection is required to create a rule');
        return;
      }

      console.log('Creating rule from template:', template);

      const response = await rulesService.createRuleFromTemplate(
        template.id,
        user.id,
        selectedDevice,
        overrides
      );
      
      if (response.success) {
        await loadRules();
        return true;
      } else {
        console.error('Failed to create rule from template:', response.message);
        return false;
      }
    } catch (error) {
      console.error('Error creating rule from template:', error);
      console.error('Create rule failed:', error.message);
      return false;
    } finally {
      setCreatingRule(false);
      setCreatingTemplateId(null);
    }
  };

  const updateRule = async (ruleId, updateData) => {
    try {
      const response = await rulesService.updateRule(ruleId, updateData);
      if (response.success) {
        await loadRules();
        return true;
      } else {
        console.error('Failed to update rule:', response.message || 'Unknown error');
        return false;
      }
    } catch (error) {
      console.error('Error updating rule:', error.message);
      return false;
    }
  };

  return {
    creatingRule,
    creatingTemplateId,
    toggleRuleStatus,
    deleteRule,
    createRuleFromTemplate,
    updateRule
  };
};
