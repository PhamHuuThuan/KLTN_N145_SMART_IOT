import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import CONFIG from '../constants/config';

const TemplateCard = ({ template, onPress, isCreating }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  
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

  const priorityInfo = getPriorityInfo(template.priority);

  return (
    <View style={[styles.templateCard, { backgroundColor: colors.surface, borderLeftColor: colors.border }]}>
      <View style={styles.templateHeader}>
        <Text style={[styles.templateName, { color: colors.primary }]}>{t(template.name)}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.color }]}>
          <MaterialIcons name={priorityInfo.icon} size={12} color="white" />
          <Text style={styles.priorityText}>{priorityInfo.label}</Text>
        </View>
      </View>
      <Text style={[styles.templateDescription, { color: colors.textSecondary }]}>{t(template.description)}</Text>
      
      {/* Template Stats */}
      <View style={styles.templateMeta}>
        <View style={[styles.templateStats, { borderTopColor: colors.border }]}>
          {template.priority !== 'urgent' && (
            <View style={styles.statItem}>
              <MaterialIcons name="timer" size={12} color={colors.gray} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {t('rules.cooldown')} {formatCooldown(template.cooldownPeriod)}
              </Text>
            </View>
          )}
          {template.priority !== 'urgent' && (
            <View style={styles.statItem}>
              <MaterialIcons name="repeat" size={12} color={colors.gray} />
              <Text style={[styles.statText, { color: colors.textSecondary }]}>
                {t('rules.unlimitedAlerts')}
              </Text>
            </View>
          )}
          {template.priority === 'urgent' && (
            <View style={styles.statItem}>
              <MaterialIcons name="priority-high" size={12} color="#F44336" />
              <Text style={[styles.statText, { color: '#F44336', fontWeight: 'bold' }]}>
                {t('rules.emergencyModeLabel')}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={[
          styles.createButton,
          { backgroundColor: colors.primary },
          isCreating && { backgroundColor: colors.gray }
        ]}
        onPress={onPress}
        disabled={isCreating}
      >
        <MaterialIcons 
          name={isCreating ? "hourglass-empty" : "tune"} 
          size={20} 
          color={colors.white} 
        />
        <Text style={[styles.createButtonText, { color: colors.white }]}>
          {isCreating ? t('rules.creatingLabel') : t('rules.customizeAndCreate')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  templateCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
    flex: 1,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginLeft: 8,
  },
  priorityText: {
    color: CONFIG.COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  templateDescription: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 18,
  },
  templateMeta: {
    marginTop: 8,
  },
  templateStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 9,
    marginLeft: 4,
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default TemplateCard;
