import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CONFIG from '../constants/config';

const RuleDetailModal = ({ onClose, selectedRule, editFields, setEditFields, onSave }) => {
  if (!selectedRule) return null;
  const { t } = useTranslation();
  const [pausing, setPausing] = useState(false);
  const [unpausing, setUnpausing] = useState(false);
  const [pausedUntilLocal, setPausedUntilLocal] = useState(selectedRule?.pausedUntil || null);

  useEffect(() => {
    setPausedUntilLocal(selectedRule?.pausedUntil || null);
  }, [selectedRule?.pausedUntil, selectedRule?._id]);

  // Initialize editFields.conditions if not exists
  useEffect(() => {
    if (selectedRule?.conditions && !editFields.conditions) {
      setEditFields(prev => ({ ...prev, conditions: selectedRule.conditions }));
    }
  }, [selectedRule?.conditions, editFields.conditions, setEditFields]);

  const isPaused = !!(pausedUntilLocal && new Date(pausedUntilLocal) > new Date());
  const pausedUntilText = isPaused ? new Date(pausedUntilLocal).toLocaleString() : '';

  const getPriorityColor = (priority) => {
    const priorityMap = {
      'low': '#4CAF50',
      'medium': '#FF9800',
      'high': '#FF5722',
      'urgent': '#F44336'
    };
    return priorityMap[priority] || '#FF9800';
  };

  const getSensorIcon = (sensor) => {
    const iconMap = {
      'temperature': 'device-thermostat',
      'humidity': 'water-drop',
      'gas_ppm': 'air',
      'smoke': 'smoke-free'
    };
    return iconMap[sensor] || 'sensors';
  };

  const getSensorLabel = (sensor) => {
    const labelMap = {
      'temperature': t('rules.temperature'),
      'humidity': t('rules.humidity'), 
      'gas_ppm': t('rules.gas'),
      'smoke': t('rules.smoke')
    };
    return labelMap[sensor] || sensor;
  };

  const getSensorUnit = (sensor) => {
    const unitMap = {
      'temperature': '°C',
      'humidity': '%',
      'gas_ppm': ' ppm',
      'smoke': ' ppm'
    };
    return unitMap[sensor] || '';
  };

  const getValueHint = (sensor) => {
    const hintMap = {
      'temperature': ' (0-100°C)',
      'humidity': ' (0-100%)',
      'gas_ppm': ' (0-1000 ppm)',
      'smoke': ' (0-500 ppm)'
    };
    return hintMap[sensor] || '';
  };

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{t('rules.ruleDetails')}</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color={CONFIG.COLORS.gray} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {isPaused && (
          <View style={styles.pausedBanner}>
            <MaterialIcons name="pause-circle" size={20} color={CONFIG.COLORS.white} />
            <Text style={styles.pausedBannerText}>{t('rules.pausedUntil')} {pausedUntilText}</Text>
            <TouchableOpacity
              disabled={unpausing}
              onPress={async () => {
                try {
                  setUnpausing(true);
                  const rulesService = (await import('../services/rulesService')).default;
                  await rulesService.updateRule(selectedRule._id, { pausedUntil: null });
                  setPausedUntilLocal(null);
                } finally {
                  setUnpausing(false);
                }
              }}
              style={styles.unpauseButton}
            >
              <Text style={styles.unpauseButtonText}>{unpausing ? t('rules.unpausing') : t('rules.unpauseNow')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.ruleName')}</Text>
        <TextInput
          style={styles.input}
          value={editFields.name}
          onChangeText={(t) => setEditFields(prev => ({ ...prev, name: t }))}
          placeholder={t('rules.ruleNamePlaceholder')}
        />
        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.ruleDescription')}</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={editFields.description}
          onChangeText={(t) => setEditFields(prev => ({ ...prev, description: t }))}
          placeholder={t('rules.descriptionPlaceholder')}
          multiline
          textAlignVertical="top"
        />

        {/* Editable Conditions */}
        {selectedRule.conditions && selectedRule.conditions.length > 0 && (
          <View style={styles.conditionsSection}>
            <Text style={styles.sectionTitle}>{t('rules.conditionsEditable')}</Text>
            {selectedRule.conditions.map((condition, index) => (
              <View key={index} style={styles.conditionEditItem}>
                <View style={styles.conditionHeader}>
                  <MaterialIcons 
                    name={getSensorIcon(condition.sensor)} 
                    size={16} 
                    color={CONFIG.COLORS.primary} 
                  />
                  <Text style={styles.conditionLabel}>{getSensorLabel(condition.sensor)}</Text>
                </View>
                
                <View style={styles.conditionInputs}>
                  {/* Operator Selector */}
                  <View style={styles.operatorSelector}>
                    <Text style={styles.inputLabel}>{t('rules.operator')}</Text>
                    <View style={styles.operatorButtons}>
                      {['>', '<', '>=', '<=', '==', '!='].map((op) => (
                        <TouchableOpacity
                          key={op}
                          style={[
                            styles.operatorButton,
                            editFields.conditions?.[index]?.operator === op && styles.operatorButtonSelected
                          ]}
                          onPress={() => {
                            const newConditions = [...editFields.conditions];
                            newConditions[index] = { ...newConditions[index], operator: op };
                            setEditFields(prev => ({ ...prev, conditions: newConditions }));
                          }}
                        >
                          <Text style={[
                            styles.operatorText,
                            editFields.conditions?.[index]?.operator === op && styles.operatorTextSelected
                          ]}>{op}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Value Input */}
                  <View style={styles.valueInput}>
                    <Text style={styles.inputLabel}>
                      {t('rules.value')} {getSensorUnit(condition.sensor)}
                      {getValueHint(condition.sensor)}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={editFields.conditions?.[index]?.value !== undefined ? String(editFields.conditions[index].value) : ''}
                      onChangeText={(text) => {
                        const newConditions = [...editFields.conditions];
                        newConditions[index] = { ...newConditions[index], value: text === '' ? '' : parseFloat(text) || 0 };
                        setEditFields(prev => ({ ...prev, conditions: newConditions }));
                      }}
                      placeholder={String(condition.value)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.priority')}</Text>
            <View style={styles.prioritySelector}>
              {['low', 'medium', 'high', 'urgent'].map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.priorityOption,
                    editFields.priority === priority && styles.priorityOptionSelected,
                    { borderColor: getPriorityColor(priority) }
                  ]}
                  onPress={() => setEditFields(prev => ({ ...prev, priority }))}
                >
                  <Text style={[
                    styles.priorityOptionText,
                    editFields.priority === priority && { color: getPriorityColor(priority) }
                  ]}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.active')}</Text>
            <Switch
              value={editFields.isActive}
              onValueChange={(val) => setEditFields(prev => ({ ...prev, isActive: val }))}
              trackColor={{ false: CONFIG.COLORS.gray, true: CONFIG.COLORS.success }}
              thumbColor={CONFIG.COLORS.white}
            />
          </View>
        </View>

        {/* Cooldown Period - Hidden for urgent priority */}
        {editFields.priority !== 'urgent' && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>{t('rules.cooldownPeriod')}</Text>
            <TextInput
              style={styles.input}
              value={editFields.cooldownPeriod ? String(Math.floor(editFields.cooldownPeriod / 60000)) : ''}
              onChangeText={(text) => {
                const minutes = parseInt(text) || 0;
                setEditFields(prev => ({ ...prev, cooldownPeriod: minutes * 60000 }));
              }}
              placeholder="5"
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Max Triggers Per Day - Hidden for urgent priority */}
        {editFields.priority !== 'urgent' && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>{t('rules.maxTriggersPerDay')}</Text>
            <TextInput
              style={styles.input}
              value={editFields.maxTriggersPerDay ? String(editFields.maxTriggersPerDay) : ''}
              onChangeText={(text) => {
                const max = parseInt(text) || 0;
                setEditFields(prev => ({ ...prev, maxTriggersPerDay: max }));
              }}
              placeholder="10"
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Duration - Hidden for urgent priority */}
        {editFields.priority !== 'urgent' && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.duration')}</Text>
            <TextInput
              style={styles.input}
              value={editFields.duration ? String(Math.floor(editFields.duration / 60000)) : ''}
              onChangeText={(text) => {
                const minutes = parseInt(text) || 0;
                setEditFields(prev => ({ ...prev, duration: minutes * 60000 }));
              }}
              placeholder="0"
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Emergency Mode Notice for Urgent Priority */}
        {editFields.priority === 'urgent' && (
          <View style={{ marginTop: 16, padding: 12, backgroundColor: '#F4433622', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#F44336' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="priority-high" size={16} color="#F44336" />
              <Text style={{ marginLeft: 6, color: '#F44336', fontWeight: 'bold', fontSize: 14 }}>{t('rules.emergencyMode')}</Text>
            </View>
            <Text style={{ color: '#F44336', fontSize: 12 }}>
              {t('rules.emergencyModeDescription')}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.createButton, { marginTop: 16 }]}
          onPress={() => {
            // Ensure conditions are properly formatted before saving
            const updatedEditFields = {
              ...editFields,
              conditions: editFields.conditions?.map(condition => ({
                ...condition,
                value: condition.value === '' ? condition.value : (typeof condition.value === 'number' ? condition.value : parseFloat(condition.value) || 0)
              }))
            };
            onSave(updatedEditFields);
          }}
        >
          <MaterialIcons name="save" size={20} color={CONFIG.COLORS.white} />
          <Text style={styles.createButtonText}>{t('rules.saveChanges')}</Text>
        </TouchableOpacity>

        {/* Quick actions: acknowledge, pause rule without toggling off */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <TouchableOpacity
            disabled={pausing}
            onPress={async () => {
              try {
                setPausing(true);
                const rulesService = (await import('../services/rulesService')).default;
                await rulesService.respondToAlert(selectedRule._id, 'acknowledged', { ruleName: selectedRule.name });
                onClose && onClose();
              } finally {
                setPausing(false);
              }
            }}
            style={[styles.pauseButton, { backgroundColor: '#4CAF50' }]}
          >
            <MaterialIcons name="check-circle" size={20} color={CONFIG.COLORS.white} />
            <Text style={styles.pauseButtonText}>{t('rules.acknowledged')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={pausing}
            onPress={async () => {
              try {
                setPausing(true);
                const rulesService = (await import('../services/rulesService')).default;
                await rulesService.respondToAlert(selectedRule._id, 'dismissed', { ruleName: selectedRule.name });
                onClose && onClose();
              } finally {
                setPausing(false);
              }
            }}
            style={[styles.pauseButton, { backgroundColor: '#FFB020' }]}
          >
            <MaterialIcons name="pause-circle" size={20} color={CONFIG.COLORS.white} />
            <Text style={styles.pauseButtonText}>{t('rules.pause1h')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={pausing}
            onPress={async () => {
              try {
                setPausing(true);
                const rulesService = (await import('../services/rulesService')).default;
                await rulesService.respondToAlert(selectedRule._id, 'false_alarm', { ruleName: selectedRule.name });
                onClose && onClose();
              } finally {
                setPausing(false);
              }
            }}
            style={[styles.pauseButton, { backgroundColor: '#E53935' }]}
          >
            <MaterialIcons name="block" size={20} color={CONFIG.COLORS.white} />
            <Text style={styles.pauseButtonText}>{t('rules.pause24h')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.light,
  },
  input: {
    backgroundColor: CONFIG.COLORS.white,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 40,
    maxHeight: 120,
    paddingTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: CONFIG.COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.COLORS.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
  },
  closeButton: {
    padding: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONFIG.COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pauseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pauseButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6D6E71',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  pausedBannerText: {
    color: CONFIG.COLORS.white,
    fontSize: 13,
    flex: 1,
  },
  unpauseButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 6,
  },
  unpauseButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  conditionsSection: {
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: CONFIG.THEME.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.light,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CONFIG.COLORS.primary,
    marginBottom: 8,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  conditionText: {
    fontSize: 13,
    color: CONFIG.THEME.gray,
    marginLeft: 8,
    flex: 1,
  },
  conditionEditItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: CONFIG.THEME.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.light,
  },
  conditionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  conditionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CONFIG.COLORS.primary,
    marginLeft: 8,
  },
  conditionInputs: {
    gap: 12,
  },
  operatorSelector: {
    marginBottom: 8,
  },
  operatorButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  operatorButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.light,
    backgroundColor: CONFIG.THEME.surface,
  },
  operatorButtonSelected: {
    backgroundColor: CONFIG.COLORS.primary,
    borderColor: CONFIG.COLORS.primary,
  },
  operatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: CONFIG.COLORS.gray,
  },
  operatorTextSelected: {
    color: CONFIG.COLORS.white,
  },
  valueInput: {
    flex: 1,
  },
  prioritySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: CONFIG.COLORS.white,
  },
  priorityOptionSelected: {
    backgroundColor: '#F5F5F5',
  },
  priorityOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: CONFIG.COLORS.gray,
  },
  rowContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  inputContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  inputLabel: {
    marginBottom: 6,
    color: CONFIG.COLORS.gray,
    fontSize: 14,
  },
});

export default RuleDetailModal;
