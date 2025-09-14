import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import CONFIG from '../constants/config';
import NotificationIcon from './NotificationIcon';

const Header = ({ onNotificationPress }) => {
  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    }
  };

  return (
    <View style={styles.header}>
      <Image
        source={require('../../assets/logo_app.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.headerTitle}>Smart IoT Kitchen</Text>
      <View style={styles.headerRight}>
        <NotificationIcon
          onPress={handleNotificationPress}
          size={24}
          color={CONFIG.THEME.surface}
        />
      </View>
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
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CONFIG.THEME.surface,
    flex: 1,
    textAlign: 'center',
  },
  logo: {
    width: 36,
    height: 36,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
});

export default Header;
