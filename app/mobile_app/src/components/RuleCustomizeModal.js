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
      'smoke': 'smoke-free',
      'flame': 'local-fire-department'
    };
    return iconMap[sensor] || 'sensors';
  };

  const getSensorLabel = (sensor) => {
    const labelMap = {
      'temperature': t('rules.temperature'),
      'humidity': t('rules.humidity'), 
      'gas_ppm': t('rules.gas'),
      'smoke': t('rules.smoke'),
      'flame': t('rules.flame')
    };
    return labelMap[sensor] || sensor;
  };

  const formatConditionThreshold = (condition, getUnit) => {
    if (!condition) return '';

    const operator = condition.operator || '';
    const value = condition.value !== undefined && condition.value !== null
      ? `${condition.value}`
      : '';
    const unit = condition.unit || getUnit(condition.sensor) || '';
    const normalizedUnit = unit.trim();

    const operatorPart = operator.trim();
    const valuePart = value.trim();

    const threshold = [operatorPart, valuePart]
      .filter(Boolean)
      .join(operatorPart && valuePart ? ' ' : '');

    return `${threshold}${normalizedUnit ? ` ${normalizedUnit}` : ''}`.trim();
  };

  // Validate conditions for logical consistency (value range is now optional/warning only)
  const validateConditions = (conditions) => {
    if (!conditions || conditions.length === 0) {
      return { valid: false, message: 'Cần ít nhất 1 điều kiện' };
    }

    return { valid: true, message: '' };
  };

  const getSensorUnit = (sensor) => {
    const unitMap = {
      'temperature': '°C',
      'humidity': '%',
      'gas_ppm': ' ppm',
      'smoke': ' V',
      'flame': ''
    };
    return unitMap[sensor] || '';
  };

  // Get default cooldown period based on priority
  const getDefaultCooldownPeriod = (priority) => {
    const defaults = {
      'urgent': 0,       // Không có thời gian chờ cho chế độ khẩn cấp
      'low': 180000,     // 3 phút
      'medium': 120000,  // 2 phút
      'high': 60000      // 1 phút
    };
    return defaults[priority] || 120000;
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
          multiline
          textAlignVertical="top"
        />
        {/* Editable Conditions */}
        {customizeTemplate.conditions && customizeTemplate.conditions.length > 0 && (
          <View style={styles.conditionsSection}>
            <Text style={styles.sectionTitle}>{t('rules.conditionsPreset', 'Điều kiện cảnh báo cố định')}</Text>
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
                  <View style={styles.thresholdContainer}>
                    <Text style={styles.inputLabel}>
                      {t('rules.thresholdValue', 'Ngưỡng cảnh báo')}
                    </Text>
                    <View style={styles.thresholdBadge}>
                      <MaterialIcons name="tune" size={16} color={CONFIG.COLORS.primary} />
                      <Text style={styles.thresholdText}>
                        {formatConditionThreshold(condition, getSensorUnit)}
                      </Text>
                    </View>
                    <Text style={styles.thresholdHint}>
                      {t('rules.thresholdFixedHint', 'Giá trị do hệ thống thiết lập, liên hệ Admin để thay đổi')}
                      </Text>
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
                const defaultCooldown = getDefaultCooldownPeriod(priority);
                setCustomFields(prev => ({ 
                  ...prev, 
                  priority,
                  cooldownPeriod: defaultCooldown
                }));
              }}
            >
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority) }]} />
              <Text style={[styles.priorityLabel, customFields.priority === priority && { color: getPriorityColor(priority), fontWeight: '700' }]}>
                {t(`rules.priority.${priority}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cooldown Period - Ẩn hoàn toàn khi urgent */}
        {customFields.priority !== 'urgent' && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.inputLabel}>
              {t('rules.cooldownMinutesLabel', 'Thời gian chờ (phút)')}
            </Text>
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


        <View style={styles.infoBanner}>
          <MaterialIcons name="notifications-active" size={16} color={CONFIG.COLORS.primary} />
          <Text style={styles.infoBannerText}>
            {t('rules.unlimitedAlertsHint')}
          </Text>
        </View>

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
                💡 Hãy kiểm tra lại các điều kiện và giá trị cảnh báo trước khi lưu
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: `${CONFIG.COLORS.primary}11`,
    borderWidth: 1,
    borderColor: `${CONFIG.COLORS.primary}33`,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: CONFIG.COLORS.gray,
    lineHeight: 16,
  },
  thresholdContainer: {
    gap: 6,
  },
  thresholdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${CONFIG.COLORS.primary}11`,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.primary,
    gap: 8,
  },
  thresholdText: {
    fontSize: 14,
    fontWeight: '600',
    color: CONFIG.COLORS.primary,
  },
  thresholdHint: {
    fontSize: 11,
    color: CONFIG.COLORS.gray,
    fontStyle: 'italic',
  },
});

export default CustomizeModal;
