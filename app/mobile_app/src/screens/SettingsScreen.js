import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import CONFIG from '../constants/config';

const SettingsScreen = ({ navigation }) => {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  const renderSettingItem = (icon, title, subtitle, onPress, showArrow = true) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={CONFIG.THEME.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={CONFIG.THEME.gray} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.THEME.primary} />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {renderSettingItem(
            'person-outline',
            'Profile',
            'Manage your account information',
            () => navigation.navigate('Profile')
          )}
          {renderSettingItem(
            'lock-closed-outline',
            'Change Password',
            'Update your password',
            () => navigation.navigate('ChangePassword')
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          {renderSettingItem(
            'notifications-outline',
            'Notifications',
            'Manage notification preferences',
            () => Alert.alert('Coming Soon', 'This feature will be available soon')
          )}
          {renderSettingItem(
            'language-outline',
            'Language',
            'English',
            () => Alert.alert('Coming Soon', 'This feature will be available soon')
          )}
          {renderSettingItem(
            'moon-outline',
            'Dark Mode',
            'System',
            () => Alert.alert('Coming Soon', 'This feature will be available soon')
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          {renderSettingItem(
            'help-circle-outline',
            'Help & Support',
            'Get help and contact support',
            () => Alert.alert('Coming Soon', 'This feature will be available soon')
          )}
          {renderSettingItem(
            'information-circle-outline',
            'About',
            'App version and information',
            () => Alert.alert('About', 'Smart IoT Kitchen v1.0.0\nBuilt with React Native & Expo')
          )}
        </View>

        <View style={styles.section}>
          {renderSettingItem(
            'log-out-outline',
            'Logout',
            'Sign out of your account',
            handleLogout,
            false
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
  },
  headerContainer: {
    backgroundColor: CONFIG.THEME.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    paddingTop: 40,
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CONFIG.COLORS.white,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    backgroundColor: CONFIG.THEME.surface,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    padding: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CONFIG.THEME.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: CONFIG.COLORS.dark,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: CONFIG.THEME.gray,
  },
});

export default SettingsScreen;
