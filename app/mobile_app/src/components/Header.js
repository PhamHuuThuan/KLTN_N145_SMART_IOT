import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const Header = () => {
  return (
    <View style={styles.header}>
      <MaterialCommunityIcons name="home" size={22} color={CONFIG.THEME.surface} />
      <Text style={styles.headerTitle}>Smart IoT Kitchen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: CONFIG.THEME.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CONFIG.THEME.surface,
  },
});

export default Header;
