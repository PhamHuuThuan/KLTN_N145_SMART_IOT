import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const CustomizeModal = ({ 
  visible, 
  onClose, 
  customizeTemplate, 
  customFields, 
  setCustomFields, 
  onCreate 
}) => {
  if (!customizeTemplate) return null;

  // Initialize customFields.conditions if not exists
  React.useEffect(() => {
    if (customizeTemplate?.conditions && !customFields.conditions) {
      setCustomFields(prev => ({ ...prev, conditions: customizeTemplate.conditions }));
    }
  }, [customizeTemplate?.conditions, customFields.conditions, setCustomFields]);

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
      'temperature': 'Temperature',
      'humidity': 'Humidity', 
      'gas_ppm': 'Gas',
      'smoke': 'Smoke'
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
        <Text style={styles.modalTitle}>Customize Rule</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <MaterialIcons name="close" size={24} color={CONFIG.COLORS.gray} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>Rule name</Text>
        <TextInput
          style={styles.input}
          value={customFields.name}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, name: t }))}
          placeholder="Rule name"
        />
        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={customFields.description}
          onChangeText={(t) => setCustomFields(prev => ({ ...prev, description: t }))}
          placeholder="Description"
          multiline
          textAlignVertical="top"
        />
        {/* Editable Conditions */}
        {customizeTemplate.conditions && customizeTemplate.conditions.length > 0 && (
          <View style={styles.conditionsSection}>
            <Text style={styles.sectionTitle}>Conditions (Editable):</Text>
            {customizeTemplate.conditions.map((condition, index) => (
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
                    <Text style={styles.inputLabel}>Operator</Text>
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
                      Value {getSensorUnit(condition.sensor)}
                      {getValueHint(condition.sensor)}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={customFields.conditions?.[index]?.value !== undefined ? String(customFields.conditions[index].value) : ''}
                      onChangeText={(text) => {
                        const newConditions = [...customFields.conditions];
                        newConditions[index] = { ...newConditions[index], value: text === '' ? '' : parseFloat(text) || 0 };
                        setCustomFields(prev => ({ ...prev, conditions: newConditions }));
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

        <Text style={{ marginTop: 12, marginBottom: 6, color: CONFIG.COLORS.gray }}>Priority</Text>
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
              onPress={() => setCustomFields(prev => ({ ...prev, priority }))}
            >
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority) }]} />
              <Text style={[styles.priorityLabel, customFields.priority === priority && { color: getPriorityColor(priority), fontWeight: '700' }]}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cooldown Period */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.inputLabel}>Cooldown Period (minutes)</Text>
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

        {/* Max Triggers Per Day */}
        <View style={{ marginTop: 16 }}>
          <Text style={styles.inputLabel}>Max Triggers/Day</Text>
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

        {/* Duration */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ marginBottom: 6, color: CONFIG.COLORS.gray }}>Duration (minutes) - 0 = instant trigger</Text>
          <TextInput
            style={styles.input}
            value={customFields.duration ? String(Math.floor(customFields.duration / 60000)) : ''}
            onChangeText={(text) => {
              const minutes = parseInt(text) || 0;
              setCustomFields(prev => ({ ...prev, duration: minutes * 60000 }));
            }}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
        <TouchableOpacity
          style={[styles.createButton, { marginTop: 16 }]}
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
          <MaterialIcons name="check" size={20} color={CONFIG.COLORS.white} />
          <Text style={styles.createButtonText}>Create with customization</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
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
    fontSize: 13,
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
});

export default CustomizeModal;
