import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const CategoryFilter = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.categoryFilter}
    >
      {categories.map(category => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.categoryButton,
            selectedCategory === category.id && styles.categoryButtonActive
          ]}
          onPress={() => onSelectCategory(category.id)}
        >
          <MaterialIcons 
            name={category.icon} 
            size={16} 
            color={selectedCategory === category.id ? CONFIG.COLORS.white : CONFIG.COLORS.primary} 
          />
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === category.id && styles.categoryButtonTextActive
          ]}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  categoryFilter: {
    height: 44,
    paddingHorizontal: 16,
    paddingVertical: 0,
    backgroundColor: CONFIG.COLORS.white,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: CONFIG.COLORS.light,
    borderWidth: 1,
    borderColor: CONFIG.COLORS.primary,
  },
  categoryButtonActive: {
    backgroundColor: CONFIG.COLORS.primary,
  },
  categoryButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: CONFIG.COLORS.primary,
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: CONFIG.COLORS.white,
  },
});

export default CategoryFilter;
