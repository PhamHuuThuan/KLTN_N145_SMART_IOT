import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CONFIG from '../constants/config';

const Header = () => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>🏠 Smart IoT Kitchen</Text>
      <Text style={styles.headerSubtitle}>Device Control & Monitoring</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: CONFIG.COLORS.primary,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: CONFIG.COLORS.white,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: CONFIG.COLORS.light,
  },
});

export default Header;
