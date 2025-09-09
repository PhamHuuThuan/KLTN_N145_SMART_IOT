import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const RuleCard = ({ 
  rule, 
  onPress, 
  onToggleStatus, 
  onDelete, 
  getCategoryIcon, 
  getCategoryColor, 
  getPriorityColor 
}) => {
  return (
    <TouchableOpacity style={styles.ruleCard} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleInfo}>
          <View style={styles.ruleTitleRow}>
            <MaterialIcons 
              name={getCategoryIcon(rule.category)} 
              size={20} 
              color={getCategoryColor(rule.category)} 
            />
            <Text style={styles.ruleName}>{rule.name}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(rule.priority) }]}>
              <Text style={styles.priorityText}>{rule.priority}</Text>
            </View>
          </View>
          <Text style={styles.ruleDescription}>{rule.description}</Text>
          <Text style={styles.ruleCategory}>
            {rule.category}
          </Text>
        </View>
        <View style={styles.ruleActions}>
          <Switch
            value={rule.isActive}
            onValueChange={() => onToggleStatus(rule._id, rule.isActive)}
            trackColor={{ false: CONFIG.COLORS.gray, true: CONFIG.COLORS.success }}
            thumbColor={CONFIG.COLORS.white}
          />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(rule._id, rule.name)}
          >
            <MaterialIcons name="delete" size={20} color={CONFIG.COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.ruleStats}>
        <Text style={styles.statText}>
          Triggered: {rule.triggerCount} times
        </Text>
        {rule.lastTriggeredAt && (
          <Text style={styles.statText}>
            Last: {new Date(rule.lastTriggeredAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ruleCard: {
    backgroundColor: CONFIG.COLORS.white,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ruleInfo: {
    flex: 1,
    marginRight: 12,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginLeft: 8,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: CONFIG.COLORS.white,
  },
  ruleDescription: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    marginBottom: 4,
  },
  ruleCategory: {
    fontSize: 12,
    color: CONFIG.COLORS.primary,
    fontWeight: '500',
  },
  ruleActions: {
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
  },
  ruleStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CONFIG.COLORS.light,
  },
  statText: {
    fontSize: 12,
    color: CONFIG.COLORS.gray,
  },
});

export default RuleCard;
