import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CategoryCard = ({ category, config, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);

  const categoryLabels = {
    sensor: 'Sensor',
    outlet: 'Outlet',
    rule: 'Rule',
    system: 'System',
    security: 'Security',
    maintenance: 'Maintenance',
    marketing: 'Marketing'
  };

  const methodLabels = {
    inApp: 'In-App',
    email: 'Email',
    sms: 'SMS',
    fcm: 'Push'
  };

  const handleCategoryToggle = (enabled) => {
    onUpdate({
      ...config,
      enabled
    });
  };

  const handleMethodToggle = (method, enabled) => {
    onUpdate({
      ...config,
      methods: {
        ...config.methods,
        [method]: enabled
      }
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons 
            name={expanded ? "chevron-down" : "chevron-forward"} 
            size={20} 
            color="#007AFF" 
            style={styles.chevron}
          />
          <Text style={styles.categoryLabel}>
            {categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1)}
          </Text>
        </View>
        <Switch 
          value={config.enabled} 
          onValueChange={handleCategoryToggle}
          trackColor={{ false: "#E5E5EA", true: "#007AFF" }}
          thumbColor={config.enabled ? "#FFFFFF" : "#FFFFFF"}
        />
      </TouchableOpacity>
      
      {expanded && config.enabled && (
        <View style={styles.methodsContainer}>
          <Text style={styles.methodsTitle}>Notification Methods:</Text>
          {Object.entries(config.methods).map(([method, enabled]) => (
            <View key={method} style={styles.methodRow}>
              <Text style={styles.methodLabel}>{methodLabels[method]}</Text>
              <Switch 
                value={enabled} 
                onValueChange={(value) => handleMethodToggle(method, value)}
                trackColor={{ false: "#E5E5EA", true: "#007AFF" }}
                thumbColor={enabled ? "#FFFFFF" : "#FFFFFF"}
                style={styles.methodSwitch}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chevron: {
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  methodsContainer: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    padding: 16,
  },
  methodsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C757D',
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  methodLabel: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
  },
  methodSwitch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});

export default CategoryCard;
