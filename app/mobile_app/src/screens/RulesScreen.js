import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import DeviceSelector from '../components/DeviceSelector';
import RuleCard from '../components/RuleCard';
import TemplateCard from '../components/TemplateCard';
import CategoryFilter from '../components/CategoryFilter';
import RuleDetailModal from '../components/RuleDetailModal';
import CustomizeModal from '../components/CustomizeModal';
import { useRulesData } from '../hooks/useRulesData';
import { useRuleActions } from '../hooks/useRuleActions';
import CONFIG from '../constants/config';

const RulesScreen = () => {
  const { user } = useAuth();
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [customizeVisible, setCustomizeVisible] = useState(false);
  const [customizeTemplate, setCustomizeTemplate] = useState(null);
  const [customFields, setCustomFields] = useState({
    name: '',
    description: '',
    priority: 5,
    category: 'automation',
    sensorValue: '',
    timeHour: '',
    timeMinute: '',
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [editFields, setEditFields] = useState({
    name: '',
    description: '',
    priority: 5,
    isActive: true,
    sensorValue: '',
    timeHour: '',
    timeMinute: '',
  });

  // Custom hooks
  const { rules, templates, devices, loading, refreshing, loadRules, onRefresh } = useRulesData();
  const { creatingRule, creatingTemplateId, toggleRuleStatus, deleteRule, createRuleFromTemplate, updateRule } = useRuleActions(loadRules);

  const categories = [
    { id: 'all', name: 'All', icon: 'list' },
    { id: 'safety', name: 'Safety', icon: 'security' },
    { id: 'energy_saving', name: 'Energy Saving', icon: 'eco' },
  ];

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
      priority: 5,
      category: template.category || 'automation',
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

  const getCategoryIcon = (category) => {
    const categoryData = categories.find(c => c.id === category);
    return categoryData ? categoryData.icon : 'settings';
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'safety':
        return CONFIG.THEME.danger;
      case 'energy_saving':
        return CONFIG.THEME.success;
      default:
        return CONFIG.THEME.gray;
    }
  };

  const getPriorityColor = (priority) => {
    if (priority >= 8) return CONFIG.THEME.danger;
    if (priority >= 6) return CONFIG.THEME.warning;
    if (priority >= 4) return CONFIG.THEME.info;
    return CONFIG.THEME.success;
  };

  const filteredRules = selectedCategory === 'all' 
    ? rules 
    : rules.filter(rule => rule.category === selectedCategory);

  const openRuleDetail = (rule) => {
    setSelectedRule(rule);
    setEditFields({
      name: rule.name || '',
      description: rule.description || '',
      priority: rule.priority ?? 5,
      isActive: !!rule.isActive,
      sensorValue: rule?.conditions?.[0]?.type === 'sensor' ? String(rule.conditions[0].value) : '',
      timeHour: rule?.conditions?.[0]?.type === 'time' ? String(rule.conditions[0]?.timeCondition?.hour ?? '') : '',
      timeMinute: rule?.conditions?.[0]?.type === 'time' ? String(rule.conditions[0]?.timeCondition?.minute ?? '') : '',
    });
    setDetailVisible(true);
  };

  const saveRuleEdits = async () => {
    if (!selectedRule) return;
    
    const update = {
      name: editFields.name,
      description: editFields.description,
      priority: Number(editFields.priority) || 5,
      isActive: editFields.isActive,
    };
    
    if (selectedRule.conditions?.[0]?.type === 'sensor' && editFields.sensorValue !== '') {
      update.conditions = [
        {
          ...selectedRule.conditions[0],
          value: Number(editFields.sensorValue),
        }
      ];
    }
    
    if (selectedRule.conditions?.[0]?.type === 'time') {
      const hour = editFields.timeHour !== '' ? Number(editFields.timeHour) : selectedRule.conditions[0].timeCondition?.hour;
      const minute = editFields.timeMinute !== '' ? Number(editFields.timeMinute) : selectedRule.conditions[0].timeCondition?.minute;
      update.conditions = [
        {
          ...selectedRule.conditions[0],
          timeCondition: {
            ...selectedRule.conditions[0].timeCondition,
            hour,
            minute,
          }
        }
      ];
    }
    
    const success = await updateRule(selectedRule._id, update);
    if (success) {
      setDetailVisible(false);
    }
  };

  const renderRuleItem = ({ item: rule }) => (
    <RuleCard
      rule={rule}
      onPress={() => openRuleDetail(rule)}
      onToggleStatus={toggleRuleStatus}
      onDelete={deleteRule}
      getCategoryIcon={getCategoryIcon}
      getCategoryColor={getCategoryColor}
      getPriorityColor={getPriorityColor}
    />
  );

  const renderTemplateItem = ({ item: template }) => (
    <TemplateCard
      template={template}
      onPress={() => openCustomize(template)}
      isCreating={creatingTemplateId === template.id}
      getCategoryIcon={getCategoryIcon}
      getCategoryColor={getCategoryColor}
    />
  );

  const renderCategoryFilter = () => (
    <CategoryFilter
      categories={categories}
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
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
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <DeviceSelector
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={(id) => {
            setSelectedDevice(id);
          }}
        />
      </View>

      {renderCategoryFilter()}

      <FlatList
        data={filteredRules}
        renderItem={renderRuleItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.rulesList}
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
          
          <FlatList
            data={templates}
            renderItem={renderTemplateItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.templatesList}
          />
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
          onCreate={() => {
            if (!customizeTemplate) return;
            const overrides = { 
              name: customFields.name, 
              description: customFields.description,
              priority: Number(customFields.priority) || 5
            };
            if (customizeTemplate.conditions?.[0]?.type === 'sensor' && customFields.sensorValue !== '') {
              overrides.conditions = [
                {
                  ...customizeTemplate.conditions[0],
                  value: Number(customFields.sensorValue)
                }
              ];
            }
            if (customizeTemplate.conditions?.[0]?.type === 'time') {
              const hour = customFields.timeHour !== '' ? Number(customFields.timeHour) : customizeTemplate.conditions[0].timeCondition?.hour;
              const minute = customFields.timeMinute !== '' ? Number(customFields.timeMinute) : customizeTemplate.conditions[0].timeCondition?.minute;
              overrides.conditions = [
                {
                  ...customizeTemplate.conditions[0],
                  timeCondition: {
                    ...customizeTemplate.conditions[0].timeCondition,
                    hour,
                    minute,
                  }
                }
              ];
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
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
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
});

export default RulesScreen;
