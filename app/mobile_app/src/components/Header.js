import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import CONFIG from '../constants/config';

const Header = () => {
  return (
    <View style={styles.header}>
      <Image
        source={require('../../assets/logo_app.png')}
        style={styles.logo}
        resizeMode="contain"
      />
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
  logo: {
    width: 36,
    height: 36,
  },
});

export default Header;
