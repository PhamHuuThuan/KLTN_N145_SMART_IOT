import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import rulesService from '../services/rulesService';
import { createLogger } from '../utils/logger';

const log = createLogger('useRuleActions');

export const useRuleActions = (loadRules) => {
  const { t } = useTranslation();
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingTemplateId, setCreatingTemplateId] = useState(null);

  const toggleRuleStatus = async (ruleId, currentStatus) => {
    try {
      const response = await rulesService.toggleRuleStatus(ruleId, !currentStatus);
      if (response.success) {
        await loadRules();
      }
    } catch (error) {
      log.error('Error toggling rule status:', error);
    }
  };

  const deleteRule = async (ruleId, ruleName) => {
    Alert.alert(
      t('rules.deleteRule'),
      t('rules.deleteRuleConfirm', { ruleName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('rules.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await rulesService.deleteRule(ruleId);
              if (response.success) {
                await loadRules();
              }
            } catch (error) {
              log.error('Error deleting rule:', error);
            }
          }
        }
      ]
    );
  };

  const createRuleFromTemplate = async (template, user, selectedDevice, overrides = {}) => {
    if (creatingRule) return;
    
    try {
      setCreatingRule(true);
      setCreatingTemplateId(template.id);
      
      const userId = user?.id || user?.userId || user?._id;
      if (!userId) {
        log.error('User ID is required to create a rule. User object:', user);
        return;
      }
      if (!selectedDevice) {
        log.error('Device selection is required to create a rule');
        return;
      }
      log.info('Creating rule from template:', template);
      const response = await rulesService.createRuleFromTemplate(
        template,
        userId,
        selectedDevice,
        overrides
      );
      
      if (response.success) {
        await loadRules();
        return true;
      } else {
        log.error('Failed to create rule from template:', response.message);
        return false;
      }
    } catch (error) {
      log.error('Error creating rule from template:', error);
      log.error('Create rule failed:', error.message);
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
        log.error('Failed to update rule:', response.message || 'Unknown error');
        return false;
      }
    } catch (error) {
      log.error('Error updating rule:', error.message);
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
