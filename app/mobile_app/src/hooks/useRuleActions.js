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
        Alert.alert('Success', `Rule ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      }
    } catch (error) {
      console.error('Error toggling rule status:', error);
      Alert.alert('Error', 'Failed to update rule status');
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
                Alert.alert('Success', 'Rule deleted successfully');
              }
            } catch (error) {
              console.error('Error deleting rule:', error);
              Alert.alert('Error', 'Failed to delete rule');
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
        Alert.alert('Error', 'Please log in again');
        return;
      }
      if (!selectedDevice) {
        Alert.alert('Error', 'Please select a device first');
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
        Alert.alert('Success', `Created rule "${template.name}" successfully!`);
        return true;
      } else {
        Alert.alert('Error', response.message || 'Failed to create rule from template');
        return false;
      }
    } catch (error) {
      console.error('Error creating rule from template:', error);
      Alert.alert('Error', `Create rule failed: ${error.message}`);
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
        Alert.alert('Thành công', 'Đã lưu thay đổi');
        return true;
      } else {
        Alert.alert('Lỗi', response.message || 'Không thể cập nhật');
        return false;
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message);
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
