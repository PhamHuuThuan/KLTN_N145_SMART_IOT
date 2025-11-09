import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CONFIG from '../constants/config';

const CustomizeModal = ({
  onClose,
  customizeTemplate,
  customFields,
  setCustomFields,
  onCreate
}) => {
  if (!customizeTemplate) return null;
  const { t } = useTranslation();

  // Initialize customFields.conditions if not exists
  React.useEffect(() => {
    if (customizeTemplate?.conditions && !customFields.conditions) {
      setCustomFields(prev => ({ ...prev, conditions: customizeTemplate.conditions }));
    }
  }, [customizeTemplate?.conditions, customFields.conditions, setCustomFields]);

  // Auto-set conditionLogic based on number of conditions
  React.useEffect(() => {
    if (customFields.conditions) {
      if (customFields.conditions.length === 1) {
        // Nếu chỉ có 1 điều kiện, set conditionLogic thành null
        setCustomFields(prev => ({ ...prev, conditionLogic: null }));
      } else if (customFields.conditions.length > 1 && !customFields.conditionLogic) {
        // Nếu có nhiều điều kiện nhưng chưa có conditionLogic, set mặc định là AND
        setCustomFields(prev => ({ ...prev, conditionLogic: 'AND' }));
      }
    }
  }, [customFields.conditions, customFields.conditionLogic, setCustomFields]);

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

  // Validate conditions for logical consistency (value range is now optional/warning only)
  const validateConditions = (conditions) => {
    if (!conditions || conditions.length === 0) return { valid: false, message: 'Cần ít nhất 1 điều kiện' };

    // Check each condition for required fields
    for (const condition of conditions) {
      if (!condition.sensor || !condition.operator || condition.value === undefined || condition.value === '') {
        return { valid: false, message: 'Tất cả điều kiện phải có đầy đủ thông tin (sensor, operator, value)' };
      }

      // Only validate if value is a valid number (not blocking on range)
      if (!validateSensorValue(condition.sensor, condition.value, customFields.priority)) {
        return { 
          valid: false, 
          message: `Giá trị ${condition.sensor} phải là số hợp lệ` 
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
        'urgent': { min: 40, max: 100, step: 1, defaultValue: 50 },
        'high': { min: 31, max: 40, step: 1, defaultValue: 35 },
        'medium': { min: 15, max: 30, step: 1, defaultValue: 25 },
        'low': { min: 0, max: 15, step: 1, defaultValue: 10 }
      },
      'humidity': {
        'urgent': { min: 80, max: 100, step: 1, defaultValue: 80 },
        'high': { min: 61, max: 80, step: 1, defaultValue: 70 },
        'medium': { min: 30, max: 60, step: 1, defaultValue: 45 },
        'low': { min: 0, max: 30, step: 1, defaultValue: 15 }
      },
      'gas_ppm': {
        'urgent': { min: 1000, max: 2000, step: 10, defaultValue: 1500 },
        'high': { min: 401, max: 1000, step: 10, defaultValue: 500 },
        'medium': { min: 200, max: 400, step: 10, defaultValue: 300 },
        'low': { min: 0, max: 200, step: 10, defaultValue: 100 }
      },
      'smoke': {
        'urgent': { min: 700, max: 1000, step: 1, defaultValue: 850 },
        'high': { min: 301, max: 700, step: 1, defaultValue: 500 },
        'medium': { min: 100, max: 300, step: 1, defaultValue: 200 },
        'low': { min: 0, max: 100, step: 1, defaultValue: 50 }
      }
    };
    return constraints[sensor]?.[priority] || { min: 0, max: 1000, step: 1, defaultValue: 100 };
  };

  // Get default value for sensor + priority (for auto-setup)
  const getDefaultValue = (sensor, priority = 'medium') => {
    const constraints = getSensorConstraints(sensor, priority);
    return constraints.defaultValue || 0;
  };

  // Check if value is in recommended range (warning only, not blocking)
  const isValueInRecommendedRange = (sensor, value, priority = 'medium') => {
    const constraints = getSensorConstraints(sensor, priority);
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) return false;
    if (numValue < constraints.min || numValue > constraints.max) return false;
    
    return true;
  };

  // Validate sensor value (only check if valid number, not range)
  const validateSensorValue = (sensor, value, priority = 'medium') => {
    const numValue = parseFloat(value);
    return !isNaN(numValue) && numValue >= 0;
  };

  const getValueHint = (sensor, priority = 'medium') => {
    const constraints = getSensorConstraints(sensor, priority);
    return ` (Khuyến nghị: ${constraints.min}-${constraints.max}, Mặc định: ${constraints.defaultValue})`;
  };

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{t('rules.customizeRule')}</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color={CONFIG.COLORS.gray} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }}>
        <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.ruleName')}</Text>
        <TextInput
          style={styles.input}
          value={customFields.name}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, name: t }))}
          placeholder={t('rules.ruleNamePlaceholder')}
        />
        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.ruleDescription')}</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={customFields.description}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, description: t }))}
          placeholder={t('rules.descriptionPlaceholder')}
          multiline
          textAlignVertical="top"
        />
        {/* Editable Conditions */}
        {customizeTemplate.conditions && customizeTemplate.conditions.length > 0 && (
          <View style={styles.conditionsSection}>
            <View style={styles.conditionsHeader}>
              <Text style={styles.sectionTitle}>{t('rules.conditionsEditable')}</Text>
              <View style={styles.conditionButtons}>
                <TouchableOpacity
                  style={[styles.addConditionButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => {
                    const currentPriority = customFields.priority || 'medium';
                    const newCondition = {
                      type: 'sensor',
                      sensor: 'temperature',
                      operator: '>',
                      value: getDefaultValue('temperature', currentPriority),
                      unit: '°C'
                    };
                    setCustomFields(prev => ({
                      ...prev,
                      conditions: [...(prev.conditions || []), newCondition]
                    }));
                  }}
                >
                  <MaterialIcons name="add" size={16} color="white" />
                  <Text style={styles.addConditionText}>{t('rules.add')}</Text>
                </TouchableOpacity>
                {customFields.conditions && customFields.conditions.length > 1 && (
                  <TouchableOpacity
                    style={[styles.addConditionButton, { backgroundColor: '#F44336' }]}
                    onPress={() => {
                      setCustomFields(prev => ({
                        ...prev,
                        conditions: prev.conditions.slice(0, -1)
                      }));
                    }}
                  >
                    <MaterialIcons name="remove" size={16} color="white" />
                    <Text style={styles.addConditionText}>{t('rules.remove')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {customFields.conditions && customFields.conditions.map((condition, index) => (
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
                    <Text style={styles.inputLabel}>{t('rules.sensorType')}</Text>
                    <View style={styles.sensorButtons}>
                      {[
                        { key: 'temperature', label: '🌡️', fullLabel: t('rules.temperature') },
                        { key: 'humidity', label: '💧', fullLabel: t('rules.humidity') },
                        { key: 'gas_ppm', label: '🚨', fullLabel: t('rules.gas') },
                        { key: 'smoke', label: '🔥', fullLabel: t('rules.smoke') }
                      ].map((sensor) => (
                        <TouchableOpacity
                          key={sensor.key}
                          style={[
                            styles.sensorButton,
                            customFields.conditions?.[index]?.sensor === sensor.key && styles.sensorButtonSelected
                          ]}
                          onPress={() => {
                            const newConditions = [...customFields.conditions];
                            const currentPriority = customFields.priority || 'medium';
                            newConditions[index] = { 
                              ...newConditions[index], 
                              sensor: sensor.key,
                              unit: getSensorUnit(sensor.key),
                              value: getDefaultValue(sensor.key, currentPriority)
                            };
                            setCustomFields(prev => ({ ...prev, conditions: newConditions }));
                          }}
                        >
                          <Text style={[
                            styles.sensorButtonText,
                            customFields.conditions?.[index]?.sensor === sensor.key && styles.sensorButtonTextSelected
                          ]}>{sensor.label}</Text>
                          <Text 
                            style={[
                              styles.sensorButtonLabel,
                              customFields.conditions?.[index]?.sensor === sensor.key && styles.sensorButtonLabelSelected
                            ]}
                            numberOfLines={2}
                          >{sensor.fullLabel}</Text>
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
                            customFields.conditions?.[index]?.operator === op && styles.operatorButtonSelected
                          ]}
                          onPress={() => {
                            const newConditions = [...customFields.conditions];
                            newConditions[index] = { ...newConditions[index], operator: op };
                            setCustomFields(prev => ({ ...prev, conditions: newConditions }));
                          }}
                        >
                          <Text style={[
                            styles.operatorText,
                            customFields.conditions?.[index]?.operator === op && styles.operatorTextSelected
                          ]}>{op}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Value Input */}
                  <View style={styles.valueInput}>
                    <Text style={styles.inputLabel}>
                      {t('rules.value')} {getSensorUnit(condition.sensor)}
                      {getValueHint(condition.sensor, customFields.priority)}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        customFields.conditions?.[index]?.value !== undefined && 
                        !validateSensorValue(condition.sensor, customFields.conditions[index].value, customFields.priority) && 
                        styles.inputError
                      ]}
                      value={customFields.conditions?.[index]?.value !== undefined ? String(customFields.conditions[index].value) : ''}
                      onChangeText={(text) => {
                        const newConditions = [...customFields.conditions];
                        const numValue = text === '' ? '' : parseFloat(text);
                        newConditions[index] = { ...newConditions[index], value: numValue };
                        setCustomFields(prev => ({ ...prev, conditions: newConditions }));
                      }}
                      placeholder={String(getDefaultValue(condition.sensor, customFields.priority))}
                      keyboardType="numeric"
                    />
                    {customFields.conditions?.[index]?.value !== undefined && 
                     !validateSensorValue(condition.sensor, customFields.conditions[index].value, customFields.priority) && (
                      <Text style={styles.errorText}>
                        Giá trị phải là số hợp lệ
                      </Text>
                    )}
                    {customFields.conditions?.[index]?.value !== undefined && 
                     validateSensorValue(condition.sensor, customFields.conditions[index].value, customFields.priority) &&
                     !isValueInRecommendedRange(condition.sensor, customFields.conditions[index].value, customFields.priority) && (
                      <Text style={styles.warningText}>
                        ⚠️ Giá trị ngoài khoảng khuyến nghị {getSensorConstraints(condition.sensor, customFields.priority).min}-{getSensorConstraints(condition.sensor, customFields.priority).max} cho mức {customFields.priority}. Bạn vẫn có thể sử dụng giá trị này.
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>{t('rules.priorityLabel')}</Text>
        <View style={styles.prioritySelector}>
          {['low', 'medium', 'high', 'urgent'].map((priority) => (
            <TouchableOpacity
              key={priority}
              activeOpacity={0.85}
              style={[
                styles.priorityChip,
                customFields.priority === priority && [styles.priorityChipSelected, { borderColor: getPriorityColor(priority), backgroundColor: `${getPriorityColor(priority)}22` }],
                { borderColor: getPriorityColor(priority) }
              ]}
              onPress={() => {
                const newPriority = priority;
                // Auto-update condition values when priority changes
                if (customFields.conditions && customFields.conditions.length > 0) {
                  const updatedConditions = customFields.conditions.map(condition => ({
                    ...condition,
                    value: getDefaultValue(condition.sensor, newPriority)
                  }));
                  setCustomFields(prev => ({ ...prev, priority: newPriority, conditions: updatedConditions }));
                } else {
                  setCustomFields(prev => ({ ...prev, priority: newPriority }));
                }
              }}
            >
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority) }]} />
              <Text style={[styles.priorityLabel, customFields.priority === priority && { color: getPriorityColor(priority), fontWeight: '700' }]}>
                {t(`rules.priority.${priority}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Condition Logic (only show if multiple conditions) */}
        {customFields.conditions && customFields.conditions.length > 1 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>{t('rules.conditionLogic')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['AND', 'OR'].map((logic) => (
                <TouchableOpacity
                  key={logic}
                  activeOpacity={0.85}
                  style={[
                    styles.priorityChip,
                    customFields.conditionLogic === logic && [styles.priorityChipSelected, { borderColor: '#2196F3', backgroundColor: '#2196F322' }],
                    { borderColor: '#2196F3' }
                  ]}
                  onPress={() => setCustomFields(prev => ({ ...prev, conditionLogic: logic }))}
                >
                  <Text style={[styles.priorityLabel, customFields.conditionLogic === logic && { color: '#2196F3', fontWeight: '700' }]}>
                    {logic === 'AND' ? t('rules.andAll') : t('rules.orOne')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Cooldown Period - Hidden for urgent priority */}
        {customFields.priority !== 'urgent' && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>{t('rules.cooldownPeriod')}</Text>
            <TextInput
              style={styles.input}
              value={customFields.cooldownPeriod ? String(Math.floor(customFields.cooldownPeriod / 60000)) : ''}
              onChangeText={(text) => {
                const minutes = parseInt(text) || 0;
                setCustomFields(prev => ({ ...prev, cooldownPeriod: minutes * 60000 }));
              }}
              placeholder="5"
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Max Triggers Per Day - Hidden for urgent priority */}
        {customFields.priority !== 'urgent' && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>{t('rules.maxTriggersPerDay')}</Text>
            <TextInput
              style={styles.input}
              value={customFields.maxTriggersPerDay ? String(customFields.maxTriggersPerDay) : ''}
              onChangeText={(text) => {
                const max = parseInt(text) || 0;
                setCustomFields(prev => ({ ...prev, maxTriggersPerDay: max }));
              }}
              placeholder="10"
              keyboardType="numeric"
            />
          </View>
        )}


        {/* Emergency Mode Notice for Urgent Priority */}
        {customFields.priority === 'urgent' && (
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
          const validation = validateConditions(customFields.conditions);
          return !validation.valid && (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#F4433622', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#F44336' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <MaterialIcons name="error" size={16} color="#F44336" />
                <Text style={{ marginLeft: 6, color: '#F44336', fontWeight: 'bold', fontSize: 14 }}>Không thể tạo rule</Text>
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
              opacity: validateConditions(customFields.conditions).valid ? 1 : 0.5
            }
          ]}
          disabled={!validateConditions(customFields.conditions).valid}
          onPress={() => {
            // Ensure conditions are properly formatted before creating
            const updatedCustomFields = {
              ...customFields,
              conditions: customFields.conditions?.map(condition => ({
                ...condition,
                value: condition.value === '' ? condition.value : (typeof condition.value === 'number' ? condition.value : parseFloat(condition.value) || 0)
              }))
            };
            onCreate(updatedCustomFields);
          }}
        >
          <MaterialIcons 
            name={validateConditions(customFields.conditions).valid ? "check" : "error"} 
            size={20} 
            color={CONFIG.COLORS.white} 
          />
          <Text style={styles.createButtonText}>
            {validateConditions(customFields.conditions).valid 
              ? t('rules.createWithCustomization') 
              : 'Sửa lỗi trước khi tạo'
            }
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    backgroundColor: CONFIG.THEME.surface,
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
    backgroundColor: CONFIG.THEME.surface,
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
    marginBottom: 20,
  },
  createButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  prioritySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: CONFIG.THEME.surface,
  },
  priorityChipSelected: {
    backgroundColor: '#F5F5F5',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  priorityLabel: {
    fontSize: 10,
    color: CONFIG.COLORS.gray,
  },
  inputLabel: {
    marginBottom: 6,
    color: CONFIG.COLORS.gray,
    fontSize: 14,
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
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    backgroundColor: CONFIG.THEME.surface,
    minHeight: 50,
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
    fontSize: 9,
    color: CONFIG.THEME.gray,
    textAlign: 'center',
    lineHeight: 11,
    numberOfLines: 2,
  },
  sensorButtonLabelSelected: {
    color: 'white',
    fontWeight: '600',
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
  warningText: {
    color: '#FF9800',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});

export default CustomizeModal;
