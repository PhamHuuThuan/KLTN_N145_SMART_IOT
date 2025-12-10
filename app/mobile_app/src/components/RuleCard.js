import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CONFIG from '../constants/config';

const RuleCard = ({ rule, onPress, onToggleStatus, onDelete }) => {
  const { t } = useTranslation();
  
  const getPriorityInfo = (priority) => {
    const priorityMap = {
      'low': { label: t('rules.low'), color: '#4CAF50', icon: 'keyboard-arrow-down' },
      'medium': { label: t('rules.medium'), color: '#FF9800', icon: 'remove' },
      'high': { label: t('rules.high'), color: '#FF5722', icon: 'keyboard-arrow-up' },
      'urgent': { label: t('rules.urgent'), color: '#F44336', icon: 'priority-high' }
    };
    return priorityMap[priority] || priorityMap['medium'];
  };

  const formatCooldown = (cooldownMs) => {
    if (!cooldownMs) return t('rules.none');
    const minutes = Math.floor(cooldownMs / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  // Function to get translated rule name and description
  const getTranslatedRuleName = (ruleName) => {
    // Check if rule name is a template key
    const templateKeys = [
      'tempEmergency', 'tempHigh', 'tempLow',
      'humidityEmergency', 'humidityHigh', 'humidityLow', 
      'gasEmergency', 'gasHigh', 'gasMedium',
      'smokeEmergency', 'smokeHigh', 'smokeMedium'
    ];
    
    if (templateKeys.includes(ruleName)) {
      return t(`rules.templates.${ruleName}.name`);
    }
    
    // Check if rule name matches any translated template name
    for (const key of templateKeys) {
      const translatedName = t(`rules.templates.${key}.name`);
      if (ruleName === translatedName) {
        return translatedName; // Return current language version
      }
    }
    
    return ruleName;
  };

  const getTranslatedRuleDescription = (ruleDescription) => {
    // Check if rule description is a template key
    const templateKeys = [
      'tempEmergency', 'tempHigh', 'tempLow',
      'humidityEmergency', 'humidityHigh', 'humidityLow', 
      'gasEmergency', 'gasHigh', 'gasMedium',
      'smokeEmergency', 'smokeHigh', 'smokeMedium'
    ];
    
    if (templateKeys.includes(ruleDescription)) {
      return t(`rules.templates.${ruleDescription}.description`);
    }
    
    // Check if rule description matches any translated template description
    for (const key of templateKeys) {
      const translatedDescription = t(`rules.templates.${key}.description`);
      if (ruleDescription === translatedDescription) {
        return translatedDescription; // Return current language version
      }
    }
    
    return ruleDescription;
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

  const priorityInfo = getPriorityInfo(rule.priority);

  return (
    <TouchableOpacity style={styles.ruleCard} activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.priorityBadgeAbsolute, { backgroundColor: priorityInfo.color }]}>
        <MaterialIcons name={priorityInfo.icon} size={12} color="white" />
        <Text style={styles.priorityText}>{priorityInfo.label}</Text>
      </View>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleInfo}>
          <View style={styles.ruleTitleRow}>
            <Text style={styles.ruleName} numberOfLines={1} ellipsizeMode="tail">{getTranslatedRuleName(rule.name)}</Text>
          </View>
          <Text style={styles.ruleDescription}>{getTranslatedRuleDescription(rule.description)}</Text>
          
          {/* Conditions Display */}
          {rule.conditions && rule.conditions.length > 0 && (
            <View style={styles.conditionsContainer}>
              <Text style={styles.conditionsLabel}>{t('rules.conditions')}</Text>
              {rule.conditions.map((condition, index) => (
                <View key={index} style={styles.conditionItem}>
                  <MaterialIcons 
                    name={getSensorIcon(condition.sensor)} 
                    size={14} 
                    color={CONFIG.COLORS.primary} 
                  />
                  <Text style={styles.conditionText}>
                    {getSensorLabel(condition.sensor)}: {condition.operator} {condition.value}
                    {getSensorUnit(condition.sensor)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          
          <View style={styles.ruleMeta}>
            <View style={styles.ruleStatsDivider} />
            <View style={styles.ruleStats}>
              <View style={styles.statsRow}>
                {rule.priority !== 'urgent' && (
                  <View style={styles.statItem}>
                    <MaterialIcons name="timer" size={12} color={CONFIG.COLORS.gray} />
                    <Text style={styles.statText}>
                      {t('rules.cooldown')} {formatCooldown(rule.cooldownPeriod)}
                    </Text>
                  </View>
                )}
                {rule.priority !== 'urgent' && (
                  <View style={styles.statItem}>
                    <MaterialIcons name="repeat" size={12} color={CONFIG.COLORS.gray} />
                    <Text style={styles.statText}>
                      {t('rules.unlimitedAlerts')}
                    </Text>
                  </View>
                )}
                {rule.priority === 'urgent' && (
                  <View style={styles.statItem}>
                    <MaterialIcons name="priority-high" size={12} color="#F44336" />
                    <Text style={[styles.statText, { color: '#F44336', fontWeight: 'bold' }]}>
                      {t('rules.emergencyModeLabel')}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <MaterialIcons name="flash-on" size={12} color={CONFIG.COLORS.gray} />
                  <Text style={styles.statText}>
                    {t('rules.triggered')} {rule.triggerCount || 0}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.ruleActions}>
          <Switch
            value={rule.isActive}
            onValueChange={() => onToggleStatus(rule._id, rule.isActive)}
            trackColor={{ false: CONFIG.COLORS.gray, true: CONFIG.COLORS.success }}
            thumbColor={CONFIG.COLORS.white}
          />
        </View>
      </View>
      {/* Full-width centered actions row */}
      <View style={styles.actionsRowFullWidth}>
        <View style={styles.actionsWrap}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <MaterialIcons name="edit" size={16} color={CONFIG.COLORS.white} />
          <Text style={styles.editButtonText}>{t('rules.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(rule._id, rule.name)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="delete" size={16} color={CONFIG.COLORS.white} />
          <Text style={styles.deleteButtonText}>{t('rules.delete')}</Text>
        </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ruleCard: {
    backgroundColor: CONFIG.THEME.surface,
    width: '100%',
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleInfo: {
    flex: 1,
    marginRight: 12,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'nowrap',
  },
  ruleName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: CONFIG.THEME.primary,
    marginLeft: 8,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  priorityBadgeAbsolute: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: CONFIG.COLORS.white,
    marginLeft: 4,
  },
  ruleDescription: {
    fontSize: 13,
    color: CONFIG.THEME.gray,
    marginBottom: 4,
  },
  conditionsContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  conditionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CONFIG.THEME.primary,
    marginBottom: 4,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  conditionText: {
    fontSize: 11,
    color: CONFIG.THEME.gray,
    marginLeft: 6,
    flex: 1,
  },
  ruleActions: {
    alignItems: 'center',
    gap: 8,
    flexDirection: 'column',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: CONFIG.COLORS.danger,
    borderRadius: 16,
    width: 100,
  },
  deleteButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  ruleMeta: {
    marginTop: 8,
  },
  actionsRowFullWidth: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleStatsDivider: {
    height: 1,
    backgroundColor: '#F0F1F3',
    marginTop: 8,
    marginBottom: 6,
  },
  ruleStats: {
    paddingTop: 8,
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexShrink: 0,
    flex: 1,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: CONFIG.COLORS.success,
    borderRadius: 16,
    width: 100,
  },
  editButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  statText: {
    fontSize: 10,
    color: CONFIG.THEME.gray,
    marginLeft: 4,
    fontWeight: '500',
    flexShrink: 1,
  },
});

export default RuleCard;
