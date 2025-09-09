import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const TemplateCard = ({ 
  template, 
  onPress, 
  isCreating, 
  getCategoryIcon, 
  getCategoryColor 
}) => {
  return (
    <View style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <MaterialIcons 
          name={getCategoryIcon(template.category)} 
          size={24} 
          color={getCategoryColor(template.category)} 
        />
        <Text style={styles.templateName}>{template.name}</Text>
      </View>
      <Text style={styles.templateDescription}>{template.description}</Text>
      <Text style={styles.templateCategory}>
        {template.category}
      </Text>
      
      <TouchableOpacity
        style={[
          styles.createButton,
          isCreating && styles.createButtonDisabled
        ]}
        onPress={onPress}
        disabled={isCreating}
      >
        <MaterialIcons 
          name={isCreating ? "hourglass-empty" : "tune"} 
          size={20} 
          color={CONFIG.COLORS.white} 
        />
        <Text style={styles.createButtonText}>
          {isCreating ? 'Creating...' : 'Customize & Create'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  templateCard: {
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
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginLeft: 12,
  },
  templateDescription: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    marginBottom: 8,
  },
  templateCategory: {
    fontSize: 12,
    color: CONFIG.COLORS.primary,
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONFIG.COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  createButtonDisabled: {
    backgroundColor: CONFIG.COLORS.gray,
  },
  createButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default TemplateCard;
