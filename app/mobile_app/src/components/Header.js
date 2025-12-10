import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import NotificationIcon from './NotificationIcon';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Header = ({ title, onBack, onNotificationPress }) => {
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    }
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.white} />
        </TouchableOpacity>
      )}
      {!onBack && (
        <Image
          source={require('../../assets/logo_app.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      )}
      <Text style={[styles.headerTitle, { color: colors.white }]}>
        {title || 'Smart IoT Kitchen'}
      </Text>
      <View style={styles.headerRight}>
        {isAuthenticated && (
          <NotificationIcon
            onPress={handleNotificationPress}
            size={24}
            color={colors.white}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  logo: {
    width: 36,
    height: 36,
  },
  backButton: {
    width: 40,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
});

export default Header;
