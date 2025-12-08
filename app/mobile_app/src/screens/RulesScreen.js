import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DeviceSelector from '../components/DeviceSelector';
import RuleCard from '../components/RuleCard';
import TemplateCard from '../components/RuleTemplateCard';
import RuleDetailModal from '../components/RuleDetailModal';
import CustomizeModal from '../components/RuleCustomizeModal';
import { useRulesData } from '../hooks/useRulesData';
import { useRuleActions } from '../hooks/useRuleActions';
import CONFIG from '../constants/config';

const RulesScreen = () => {
  const { t } = useTranslation();
  const templatesListRef = useRef(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [customizeTemplate, setCustomizeTemplate] = useState(null);
  const [customFields, setCustomFields] = useState({
    name: '',
    description: '',
    priority: 'medium',
    cooldownPeriod: 300000,
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [editFields, setEditFields] = useState({
    name: '',
    description: '',
    priority: 'medium',
    isActive: true,
    cooldownPeriod: 300000,
  });
  const { rules, templates, devices, loading, refreshing, loadRules, onRefresh } = useRulesData();
  const { creatingRule, creatingTemplateId, toggleRuleStatus, deleteRule, createRuleFromTemplate, updateRule } = useRuleActions(loadRules);

  // Sort templates by priority
  const sortedTemplates = templates.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      // Set first device's deviceId as selected
      const firstDevice = devices[0];
      const deviceId = typeof firstDevice === 'string' ? firstDevice : firstDevice?.deviceId;
      if (deviceId) {
        setSelectedDevice(deviceId);
      }
    }
  }, [devices]);

  useEffect(() => {
    if (selectedDevice) {
      // Ensure we pass deviceId string to loadRules
      const deviceId = typeof selectedDevice === 'string' ? selectedDevice : selectedDevice?.deviceId;
      if (deviceId) {
        loadRules(deviceId);
      }
    }
  }, [selectedDevice]);

  const openCustomize = (template) => {
    // Create translated template
    const translatedTemplate = {
      ...template,
      name: t(template.name),
      description: t(template.description),
      actions: template.actions?.map(action => ({
        ...action,
        message: t(action.message)
      }))
    };
    
    setCustomizeTemplate(translatedTemplate);
    setCustomFields({
      name: translatedTemplate.name || '',
      description: translatedTemplate.description || '',
      priority: template.priority || 'medium',
      cooldownPeriod: template.cooldownPeriod || 300000,
      conditions: template.conditions || [],
    });
    setCustomizeVisible(true);
  };

  const isDuplicateRule = (template, deviceId, overrides = {}) => {
    const targetName = overrides.name || t(template.name) || template.name;
    return rules.some(
      (rule) =>
        rule.deviceId === deviceId &&
        rule.name === targetName &&
        !rule.deletedAt
    );
  };

  const handleCreateRuleFromTemplate = async (template, overrides = {}) => {
    // Ensure we pass device ID string, not device object
    const deviceId = typeof selectedDevice === 'string' ? selectedDevice : selectedDevice?.deviceId || selectedDevice?._id;
    
    if (!deviceId) {
      console.error('No device ID available for rule creation');
      return;
    }

    if (isDuplicateRule(template, deviceId, overrides)) {
      Alert.alert(t('rules.duplicateRuleForDevice'));
      return;
    }
    
    const success = await createRuleFromTemplate(template, deviceId, overrides);
    if (success) {
      setShowTemplatesModal(false);
      setCustomizeVisible(false);
    }
  };

  const openRuleDetail = (rule) => {
    setSelectedRule(rule);
    setEditFields({
      name: rule.name || '',
      description: rule.description || '',
      priority: rule.priority || 'medium',
      isActive: !!rule.isActive,
      cooldownPeriod: rule.cooldownPeriod || 300000,
      conditions: rule.conditions || [],
    });
    setDetailVisible(true);
  };

  const saveRuleEdits = async (updatedEditFields) => {
    if (!selectedRule) return;
    setBusyAction('save');
    const fields = updatedEditFields || editFields;
    const update = {
      name: fields.name,
      description: fields.description,
      priority: fields.priority,
      isActive: fields.isActive,
      cooldownPeriod: fields.cooldownPeriod,
    };
    
    // Use the updated conditions from editFields
    if (fields.conditions && fields.conditions.length > 0) {
      update.conditions = fields.conditions.map(condition => ({
        ...condition,
        value: condition.value === '' ? condition.value : (typeof condition.value === 'number' ? condition.value : parseFloat(condition.value) || 0)
      }));
    }
    
    const success = await updateRule(selectedRule._id, update);
    if (success) {
      setDetailVisible(false);
    }
    setBusyAction(null);
  };

  const renderRuleItem = ({ item: rule }) => (
    <RuleCard
      rule={rule}
      onPress={() => openRuleDetail(rule)}
      onToggleStatus={toggleRuleStatus}
      onDelete={deleteRule}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('rules.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('rules.rulesManagement')}</Text>
      </View>

      {/* Device selector for scoping rules to a device */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        <DeviceSelector
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={(deviceIdOrDevice) => {
            // Handle both deviceId string and device object
            const deviceId = typeof deviceIdOrDevice === 'string' 
              ? deviceIdOrDevice 
              : deviceIdOrDevice?.deviceId || deviceIdOrDevice?._id;
            if (deviceId) {
              setSelectedDevice(deviceId);
            }
          }}
          showAddButton={false}
        />
      </View>

      {/* Add Rule Button */}
      <View style={styles.addRuleContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setShowTemplatesModal(true);
            // Reset scroll position when opening templates modal
            setTimeout(() => {
              if (templatesListRef.current) {
                templatesListRef.current.scrollToOffset({ offset: 0, animated: false });
              }
            }, 200);
          }}
        >
          <MaterialIcons name="add" size={18} color={CONFIG.THEME.surface} />
          <Text style={styles.actionButtonText}>{t('rules.addRule')}</Text>
        </TouchableOpacity>
      </View>

      {/* Rules section */}
      <View style={styles.rulesCard}>
        <View style={styles.rulesHeader}>
          <MaterialIcons name="rule" size={20} color={CONFIG.THEME.primary} />
          <Text style={styles.sectionTitle}>{t('rules.ruleData')}</Text>
        </View>

        <FlatList
          data={rules}
          renderItem={renderRuleItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          style={styles.rulesListView}
          contentContainerStyle={styles.rulesList}
          showsVerticalScrollIndicator={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="rule" size={48} color={CONFIG.THEME.gray} />
              <Text style={styles.emptyText}>{t('rules.noRulesYet')}</Text>
              <Text style={styles.emptySubtext}>
                {t('rules.createFirstRule')}
              </Text>
            </View>
          }
        />
      </View>

      {/* Templates Modal */}
      <Modal
        visible={showTemplatesModal}
        animationType="fade"
        onRequestClose={() => setShowTemplatesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('rules.ruleTemplates')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTemplatesModal(false)}
            >
              <MaterialIcons name="close" size={24} color={CONFIG.THEME.gray} />
            </TouchableOpacity>
          </View>
          
          {templates.length === 0 ? (
            <View style={[styles.emptyContainer, { paddingTop: 48, paddingBottom: 40 }]}>
              <MaterialIcons name="library-books" size={64} color={CONFIG.THEME.gray} />
              <Text style={styles.emptyText}>{t('rules.noTemplatesAvailable')}</Text>
              <Text style={styles.emptySubtext}>
                {t('rules.templatesNotLoaded')}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={templatesListRef}
              data={sortedTemplates}
              renderItem={({ item: template, index }) => (
                <TemplateCard
                  key={template.id || template._id || index}
                  template={template}
                  onPress={() => openCustomize(template)}
                  isCreating={creatingTemplateId === template.id}
                />
              )}
              keyExtractor={(item, index) => item.id || item._id || index.toString()}
              style={styles.templatesFlatList}
              contentContainerStyle={styles.templatesList}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              removeClippedSubviews={false}
            />
          )}
          {creatingRule && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>{t('rules.creating')}</Text>
            </View>
          )}
        </View>
      </Modal>
      {/* Rule Detail Modal */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <RuleDetailModal
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          selectedRule={selectedRule}
          editFields={editFields}
          setEditFields={setEditFields}
          onSave={saveRuleEdits}
        />
        {busyAction === 'save' && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>{t('common.saving')}</Text>
          </View>
        )}
      </Modal>
      {/* Customize Modal */}
      <Modal
        visible={customizeVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CustomizeModal
          visible={customizeVisible}
          onClose={() => setCustomizeVisible(false)}
          customizeTemplate={customizeTemplate}
          customFields={customFields}
          setCustomFields={setCustomFields}
          onCreate={(updatedCustomFields) => {
            if (!customizeTemplate) return;
            const fields = updatedCustomFields || customFields;
            const overrides = {
              name: fields.name, 
              description: fields.description,
              priority: fields.priority,
              cooldownPeriod: fields.cooldownPeriod,
            };
            
            // Use the updated conditions from customFields
            if (fields.conditions && fields.conditions.length > 0) {
              overrides.conditions = fields.conditions.map(condition => ({
                ...condition,
                value: condition.value === '' ? condition.value : (typeof condition.value === 'number' ? condition.value : parseFloat(condition.value) || 0)
              }));
            }
            
            handleCreateRuleFromTemplate(customizeTemplate, overrides);
          }}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: CONFIG.THEME.gray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: CONFIG.THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CONFIG.THEME.primary,
  },
  addRuleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: CONFIG.THEME.primary,
    borderWidth: 1,
    borderColor: CONFIG.THEME.primary,
    minWidth: 120,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: CONFIG.THEME.surface,
  },
  rulesList: {
    padding: 12,
    paddingBottom: 40,
  },
  emptyContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 24,
    paddingTop: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CONFIG.THEME.gray,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: CONFIG.THEME.gray,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
    marginTop: 20,
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: CONFIG.THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CONFIG.THEME.primary,
  },
  closeButton: {
    padding: 4,
  },
  templatesFlatList: {
    flex: 1,
  },
  templatesList: {
    padding: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: CONFIG.THEME.primary,
    textAlign: 'center',
    marginLeft: 8,
  },
  rulesCard: {
    marginHorizontal: 12,
    marginTop: 2,
    backgroundColor: CONFIG.THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    paddingBottom: 8,
    flex: 1,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  rulesListView: {
    flex: 1,
  },
});

export default RulesScreen;
