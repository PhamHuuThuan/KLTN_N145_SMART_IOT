import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import DeviceSelector from '../components/DeviceSelector';
import RuleCard from '../components/RuleCard';
import TemplateCard from '../components/RuleTemplateCard';
import RuleDetailModal from '../components/RuleDetailModal';
import CustomizeModal from '../components/RuleCustomizeModal';
import { useRulesData } from '../hooks/useRulesData';
import { useRuleActions } from '../hooks/useRuleActions';
import CONFIG from '../constants/config';

const RulesScreen = () => {
  const { user } = useAuth();
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [customizeTemplate, setCustomizeTemplate] = useState(null);
  const [customFields, setCustomFields] = useState({
    name: '',
    description: '',
    priority: 'medium',
    maxTriggersPerDay: 10,
    cooldownPeriod: 300000,
    sensorValue: '',
    timeHour: '',
    timeMinute: '',
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [editFields, setEditFields] = useState({
    name: '',
    description: '',
    priority: 'medium',
    isActive: true,
    maxTriggersPerDay: 10,
    cooldownPeriod: 300000,
    sensorValue: '',
    timeHour: '',
    timeMinute: '',
  });
  const { rules, templates, devices, loading, refreshing, loadRules, onRefresh } = useRulesData();
  const { creatingRule, creatingTemplateId, toggleRuleStatus, deleteRule, createRuleFromTemplate, updateRule } = useRuleActions(loadRules);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0]);
    }
  }, [devices]);

  useEffect(() => {
    if (selectedDevice) {
      loadRules(selectedDevice);
    }
  }, [selectedDevice]);

  const openCustomize = (template) => {
    setCustomizeTemplate(template);
    setCustomFields({
      name: template.name || '',
      description: template.description || '',
      priority: template.priority || 'medium',
      maxTriggersPerDay: template.maxTriggersPerDay || 10,
      cooldownPeriod: template.cooldownPeriod || 300000,
      duration: template.duration || 0,
      conditions: template.conditions || [],
      sensorValue: template?.conditions?.[0]?.type === 'sensor' ? `${template.conditions[0].value}` : '',
      timeHour: template?.conditions?.[0]?.type === 'time' ? `${template.conditions[0]?.timeCondition?.hour ?? ''}` : '',
      timeMinute: template?.conditions?.[0]?.type === 'time' ? `${template.conditions[0]?.timeCondition?.minute ?? ''}` : '',
    });
    setCustomizeVisible(true);
  };

  const handleCreateRuleFromTemplate = async (template, overrides = {}) => {
    const success = await createRuleFromTemplate(template, user, selectedDevice, overrides);
    if (success) {
      setShowTemplatesModal(false);
      setCustomizeVisible(false);
    }
  };

  const getPriorityColor = (priority) => {
    const priorityMap = {
      'urgent': '#F44336',
      'high': '#FF5722', 
      'medium': '#FF9800',
      'low': '#4CAF50'
    };
    return priorityMap[priority] || '#FF9800';
  };

  const filteredRules = rules;

  const openRuleDetail = (rule) => {
    setSelectedRule(rule);
    setEditFields({
      name: rule.name || '',
      description: rule.description || '',
      priority: rule.priority || 'medium',
      isActive: !!rule.isActive,
      maxTriggersPerDay: rule.maxTriggersPerDay || 10,
      cooldownPeriod: rule.cooldownPeriod || 300000,
      duration: rule.duration || 0,
      conditions: rule.conditions || [],
      sensorValue: rule?.conditions?.[0]?.type === 'sensor' ? String(rule.conditions[0].value) : '',
      timeHour: rule?.conditions?.[0]?.type === 'time' ? String(rule.conditions[0]?.timeCondition?.hour ?? '') : '',
      timeMinute: rule?.conditions?.[0]?.type === 'time' ? String(rule.conditions[0]?.timeCondition?.minute ?? '') : '',
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
      maxTriggersPerDay: fields.maxTriggersPerDay,
      cooldownPeriod: fields.cooldownPeriod,
      duration: fields.duration,
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
      getPriorityColor={getPriorityColor}
    />
  );

  const renderTemplateItem = ({ item: template }) => (
    <TemplateCard
      template={template}
      onPress={() => openCustomize(template)}
      isCreating={creatingTemplateId === template.id}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading rules...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rules Management</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowTemplatesModal(true)}
        >
          <MaterialIcons name="library-books" size={20} color={CONFIG.THEME.primary} />
        </TouchableOpacity>
      </View>

      {/* Device selector for scoping rules to a device */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        <DeviceSelector
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={(id) => {
            setSelectedDevice(id);
          }}
        />
      </View>

      {/* Rules section */}
      <View style={styles.rulesCard}>
        <View style={styles.rulesHeader}>
          <MaterialIcons name="rule" size={20} color={CONFIG.THEME.primary} />
          <Text style={styles.sectionTitle}>Rule Data</Text>
        </View>

        <FlatList
          data={filteredRules}
          renderItem={renderRuleItem}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          style={styles.rulesListView}
          contentContainerStyle={styles.rulesList}
          nestedScrollEnabled={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="rule" size={48} color={CONFIG.THEME.gray} />
              <Text style={styles.emptyText}>No rules yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first rule from available templates
              </Text>
            </View>
          }
        />
      </View>

      {/* Templates Modal */}
      <Modal
        visible={showTemplatesModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rule Templates</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTemplatesModal(false)}
            >
              <MaterialIcons name="close" size={24} color={CONFIG.THEME.gray} />
            </TouchableOpacity>
          </View>
          
          {templates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="library-books" size={64} color={CONFIG.THEME.gray} />
              <Text style={styles.emptyText}>No Templates Available</Text>
              <Text style={styles.emptySubtext}>
                Rule templates are not loaded. Please check your connection and try again.
              </Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              renderItem={renderTemplateItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.templatesList}
            />
          )}
          {creatingRule && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Creating...</Text>
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
            <Text style={styles.loadingText}>Saving...</Text>
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
              maxTriggersPerDay: fields.maxTriggersPerDay,
              cooldownPeriod: fields.cooldownPeriod,
              duration: fields.duration,
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
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: CONFIG.THEME.background,
  },
  rulesList: {
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 12,
    alignItems: 'stretch'
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
  templatesList: {
    padding: 16,
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
    flexGrow: 1,
  },
});

export default RulesScreen;
