import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import CONFIG from '../constants/config';

const RuleDetailModal = ({ onClose, selectedRule, editFields, setEditFields, onSave }) => {
  if (!selectedRule) return null;
  const { t } = useTranslation();
  const { token } = useAuth();
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

  // Validate conditions for logical consistency and value ranges
  const validateConditions = (conditions) => {
    if (!conditions || conditions.length === 0) return { valid: false, message: 'Cần ít nhất 1 điều kiện' };

    // Check each condition for value validation
    for (const condition of conditions) {
      if (!condition.sensor || !condition.operator || condition.value === undefined || condition.value === '') {
        return { valid: false, message: 'Tất cả điều kiện phải có đầy đủ thông tin' };
      }

      // Validate sensor value range based on priority
      if (!validateSensorValue(condition.sensor, condition.value, editFields.priority)) {
        const constraints = getSensorConstraints(condition.sensor, editFields.priority);
        return { 
          valid: false, 
          message: `Giá trị ${condition.sensor} phải trong khoảng ${constraints.min}-${constraints.max} cho mức độ ${editFields.priority}` 
        };
      }
    }

    // If only one condition, it's valid
    if (conditions.length < 2) return { valid: true, message: '' };

    // Group conditions by sensor
    const sensorGroups = {};
    conditions.forEach(condition => {
      if (condition.sensor) {
        if (!sensorGroups[condition.sensor]) {
          sensorGroups[condition.sensor] = [];
        }
        sensorGroups[condition.sensor].push(condition);
      }
    });

    // Check each sensor group for conflicts
    for (const [sensor, sensorConditions] of Object.entries(sensorGroups)) {
      if (sensorConditions.length < 2) continue;

      const values = sensorConditions.map(c => parseFloat(c.value)).filter(v => !isNaN(v));
      if (values.length < 2) continue;

      // Check for redundant conditions (same operator, overlapping ranges)
      const operators = sensorConditions.map(c => c.operator);
      const hasGreater = operators.some(op => ['>', '>='].includes(op));
      const hasLess = operators.some(op => ['<', '<='].includes(op));

      if (hasGreater && hasLess) {
        const maxGreater = Math.max(...values.filter((v, i) => ['>', '>='].includes(operators[i])));
        const minLess = Math.min(...values.filter((v, i) => ['<', '<='].includes(operators[i])));
        
        if (maxGreater >= minLess) {
          return {
            valid: false,
            message: `Mâu thuẫn: ${sensor} > ${maxGreater} và ${sensor} < ${minLess} không thể xảy ra cùng lúc`
          };
        }
      }

      // Check for redundant conditions (same direction)
      if (hasGreater && !hasLess) {
        const sortedValues = values.sort((a, b) => a - b);
        if (sortedValues.length > 1) {
          return {
            valid: false,
            message: `Dư thừa: ${sensor} > ${sortedValues[0]} đã bao gồm ${sensor} > ${sortedValues[sortedValues.length - 1]}`
          };
        }
      }

      if (hasLess && !hasGreater) {
        const sortedValues = values.sort((a, b) => b - a);
        if (sortedValues.length > 1) {
          return {
            valid: false,
            message: `Dư thừa: ${sensor} < ${sortedValues[0]} đã bao gồm ${sensor} < ${sortedValues[sortedValues.length - 1]}`
          };
        }
      }
    }

    return { valid: true, message: '' };
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

  // Validation constraints for sensor values based on priority
  const getSensorConstraints = (sensor, priority = 'medium') => {
    const constraints = {
      'temperature': {
        'urgent': { min: 40, max: 100, step: 1 },
        'high': { min: 31, max: 40, step: 1 },
        'medium': { min: 15, max: 30, step: 1 },
        'low': { min: 0, max: 15, step: 1 }
      },
      'humidity': {
        'urgent': { min: 80, max: 100, step: 1 },
        'high': { min: 61, max: 80, step: 1 },
        'medium': { min: 30, max: 60, step: 1 },
        'low': { min: 0, max: 30, step: 1 }
      },
      'gas_ppm': {
        'urgent': { min: 1000, max: 2000, step: 10 },
        'high': { min: 401, max: 1000, step: 10 },
        'medium': { min: 200, max: 400, step: 10 },
        'low': { min: 0, max: 200, step: 10 }
      },
      'smoke': {
        'urgent': { min: 700, max: 1000, step: 1 },
        'high': { min: 301, max: 700, step: 1 },
        'medium': { min: 100, max: 300, step: 1 },
        'low': { min: 0, max: 100, step: 1 }
      }
    };
    return constraints[sensor]?.[priority] || { min: 0, max: 1000, step: 1 };
  };

  const validateSensorValue = (sensor, value, priority = 'medium') => {
    const constraints = getSensorConstraints(sensor, priority);
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) return false;
    if (numValue < constraints.min || numValue > constraints.max) return false;
    
    return true;
  };

  const getValueHint = (sensor, priority = 'medium') => {
    const constraints = getSensorConstraints(sensor, priority);
    return ` (${constraints.min}-${constraints.max})`;
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
                  await rulesService.updateRule(selectedRule._id, { pausedUntil: null }, token);
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
        {editFields.conditions && editFields.conditions.length > 0 && (
          <View style={styles.conditionsSection}>
            <View style={styles.conditionsHeader}>
              <Text style={styles.sectionTitle}>{t('rules.conditionsEditable')}</Text>
              <View style={styles.conditionButtons}>
                <TouchableOpacity
                  style={[styles.addConditionButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => {
                    const newCondition = {
                      type: 'sensor',
                      sensor: 'temperature',
                      operator: '>',
                      value: 0,
                      unit: '°C'
                    };
                    setEditFields(prev => ({
                      ...prev,
                      conditions: [...(prev.conditions || []), newCondition]
                    }));
                  }}
                >
                  <MaterialIcons name="add" size={16} color="white" />
                  <Text style={styles.addConditionText}>Thêm</Text>
                </TouchableOpacity>
                {editFields.conditions && editFields.conditions.length > 1 && (
                  <TouchableOpacity
                    style={[styles.addConditionButton, { backgroundColor: '#F44336' }]}
                    onPress={() => {
                      setEditFields(prev => ({
                        ...prev,
                        conditions: prev.conditions.slice(0, -1)
                      }));
                    }}
                  >
                    <MaterialIcons name="remove" size={16} color="white" />
                    <Text style={styles.addConditionText}>Bớt</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {editFields.conditions.map((condition, index) => (
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
                  {/* Sensor Type Selector */}
                  <View style={styles.operatorSelector}>
                    <Text style={styles.inputLabel}>Loại cảm biến</Text>
                    <View style={styles.sensorButtons}>
                      {[
                        { key: 'temperature', label: '🌡️', fullLabel: 'Nhiệt độ' },
                        { key: 'humidity', label: '💧', fullLabel: 'Độ ẩm' },
                        { key: 'gas_ppm', label: '🚨', fullLabel: 'Khí gas' },
                        { key: 'smoke', label: '🔥', fullLabel: 'Khói' }
                      ].map((sensor) => (
                        <TouchableOpacity
                          key={sensor.key}
                          style={[
                            styles.sensorButton,
                            editFields.conditions?.[index]?.sensor === sensor.key && styles.sensorButtonSelected
                          ]}
                          onPress={() => {
                            const newConditions = [...editFields.conditions];
                            newConditions[index] = { 
                              ...newConditions[index], 
                              sensor: sensor.key,
                              unit: getSensorUnit(sensor.key)
                            };
                            setEditFields(prev => ({ ...prev, conditions: newConditions }));
                          }}
                        >
                          <Text style={[
                            styles.sensorButtonText,
                            editFields.conditions?.[index]?.sensor === sensor.key && styles.sensorButtonTextSelected
                          ]}>{sensor.label}</Text>
                          <Text style={[
                            styles.sensorButtonLabel,
                            editFields.conditions?.[index]?.sensor === sensor.key && styles.sensorButtonLabelSelected
                          ]}>{sensor.fullLabel}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

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
                      {getValueHint(condition.sensor, editFields.priority)}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        editFields.conditions?.[index]?.value !== undefined && 
                        !validateSensorValue(condition.sensor, editFields.conditions[index].value, editFields.priority) && 
                        styles.inputError
                      ]}
                      value={editFields.conditions?.[index]?.value !== undefined ? String(editFields.conditions[index].value) : ''}
                      onChangeText={(text) => {
                        const newConditions = [...editFields.conditions];
                        const numValue = text === '' ? '' : parseFloat(text);
                        newConditions[index] = { ...newConditions[index], value: numValue };
                        setEditFields(prev => ({ ...prev, conditions: newConditions }));
                      }}
                      placeholder={String(condition.value)}
                      keyboardType="numeric"
                    />
                    {editFields.conditions?.[index]?.value !== undefined && 
                     !validateSensorValue(condition.sensor, editFields.conditions[index].value, editFields.priority) && (
                      <Text style={styles.errorText}>
                        {t('rules.valueOutOfRange')} {getValueHint(condition.sensor, editFields.priority)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ marginTop: 12 }}>
          <View>
            <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.priorityLabel')}</Text>
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
                    {t(`rules.priority.${priority}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Condition Logic (only show if multiple conditions) */}
        {editFields.conditions && editFields.conditions.length > 1 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>Logic điều kiện</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['AND', 'OR'].map((logic) => (
                <TouchableOpacity
                  key={logic}
                  activeOpacity={0.85}
                  style={[
                    styles.priorityChip,
                    editFields.conditionLogic === logic && [styles.priorityChipSelected, { borderColor: '#2196F3', backgroundColor: '#2196F322' }],
                    { borderColor: '#2196F3' }
                  ]}
                  onPress={() => setEditFields(prev => ({ ...prev, conditionLogic: logic }))}
                >
                  <Text style={[styles.priorityLabel, editFields.conditionLogic === logic && { color: '#2196F3', fontWeight: '700' }]}>
                    {logic === 'AND' ? 'VÀ (tất cả)' : 'HOẶC (một trong)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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

        {/* Validation Error */}
        {(() => {
          const validation = validateConditions(editFields.conditions);
          return !validation.valid && (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#F4433622', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#F44336' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <MaterialIcons name="error" size={16} color="#F44336" />
                <Text style={{ marginLeft: 6, color: '#F44336', fontWeight: 'bold', fontSize: 14 }}>Không thể lưu rule</Text>
              </View>
              <Text style={{ color: '#F44336', fontSize: 12, marginBottom: 4 }}>
                {validation.message}
              </Text>
              <Text style={{ color: '#F44336', fontSize: 11, fontStyle: 'italic' }}>
                💡 Hãy sửa lại điều kiện hoặc chọn logic OR để kích hoạt khi một trong các điều kiện đúng
              </Text>
            </View>
          );
        })()}
        
        <TouchableOpacity
          style={[
            styles.createButton, 
            { 
              marginTop: 16,
              opacity: validateConditions(editFields.conditions).valid ? 1 : 0.5
            }
          ]}
          disabled={!validateConditions(editFields.conditions).valid}
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
          <MaterialIcons 
            name={validateConditions(editFields.conditions).valid ? "save" : "error"} 
            size={20} 
            color={CONFIG.COLORS.white} 
          />
          <Text style={styles.createButtonText}>
            {validateConditions(editFields.conditions).valid 
              ? t('rules.saveChanges') 
              : 'Sửa lỗi trước khi lưu'
            }
          </Text>
        </TouchableOpacity>

        {/* Quick actions: acknowledge, pause rule without toggling off */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            disabled={pausing}
            onPress={async () => {
              try {
                setPausing(true);
                const rulesService = (await import('../services/rulesService')).default;
                await rulesService.respondToAlert(selectedRule._id, 'acknowledged', { ruleName: selectedRule.name }, undefined, token);
                onClose && onClose();
              } finally {
                setPausing(false);
              }
            }}
            style={[styles.pauseButton, { backgroundColor: '#4CAF50' }]}
          >
            <MaterialIcons name="check-circle" size={16} color={CONFIG.COLORS.white} />
            <Text style={styles.pauseButtonText}>Xác nhận</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={pausing}
            onPress={async () => {
              try {
                setPausing(true);
                const rulesService = (await import('../services/rulesService')).default;
                await rulesService.respondToAlert(selectedRule._id, 'dismissed', { ruleName: selectedRule.name }, undefined, token);
                onClose && onClose();
              } finally {
                setPausing(false);
              }
            }}
            style={[styles.pauseButton, { backgroundColor: '#FFB020' }]}
          >
            <MaterialIcons name="pause-circle" size={16} color={CONFIG.COLORS.white} />
            <Text style={styles.pauseButtonText}>Tạm dừng 1h</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={pausing}
            onPress={async () => {
              try {
                setPausing(true);
                const rulesService = (await import('../services/rulesService')).default;
                await rulesService.respondToAlert(selectedRule._id, 'false_alarm', { ruleName: selectedRule.name }, undefined, token);
                onClose && onClose();
              } finally {
                setPausing(false);
              }
            }}
            style={[styles.pauseButton, { backgroundColor: '#E53935' }]}
          >
            <MaterialIcons name="block" size={16} color={CONFIG.COLORS.white} />
            <Text style={styles.pauseButtonText}>Tạm dừng 24h</Text>
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
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pauseButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
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
    fontSize: 10,
    fontWeight: '500',
    color: CONFIG.COLORS.gray,
  },
  inputLabel: {
    marginBottom: 6,
    color: CONFIG.COLORS.gray,
    fontSize: 14,
  },
  conditionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  addConditionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 2,
    minWidth: 50,
  },
  addConditionText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
  },
  sensorButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  sensorButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    backgroundColor: CONFIG.THEME.surface,
  },
  sensorButtonSelected: {
    backgroundColor: CONFIG.THEME.primary,
    borderColor: CONFIG.THEME.primary,
  },
  sensorButtonText: {
    fontSize: 16,
    marginBottom: 2,
  },
  sensorButtonTextSelected: {
    color: 'white',
  },
  sensorButtonLabel: {
    fontSize: 10,
    color: CONFIG.THEME.gray,
    textAlign: 'center',
  },
  sensorButtonLabelSelected: {
    color: 'white',
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#F44336',
    borderWidth: 2,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default RuleDetailModal;
