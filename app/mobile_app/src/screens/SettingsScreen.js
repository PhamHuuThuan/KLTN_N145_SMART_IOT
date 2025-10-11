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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeSwitcher from '../components/ThemeSwitcher';
import CONFIG from '../constants/config';

const SettingsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { colors } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      t('common.logout'),
      t('settings.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.logout'), 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  const renderSettingItem = (icon, title, subtitle, onPress, showArrow = true) => (
    <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.border }]} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.gray} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.primary} />
      
      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.primary }]}>
        <View style={styles.headerLeft} />
        <Text style={[styles.headerTitle, { color: colors.white }]}>{t('settings.title')}</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>{t('settings.accountSettings')}</Text>
          {renderSettingItem(
            'person-outline',
            t('common.profile'),
            t('profile.personalInfo'),
            () => navigation.navigate('Profile')
          )}
          {renderSettingItem(
            'lock-closed-outline',
            t('settings.changePassword'),
            t('profile.changePassword'),
            () => navigation.navigate('ChangePassword')
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>{t('settings.appSettings')}</Text>
          {renderSettingItem(
            'notifications-outline',
            t('settings.notificationsSettings'),
            t('settings.notificationSettings'),
            () => navigation.navigate('NotificationSettingsFromSettings')
          )}
          <LanguageSwitcher />
          <ThemeSwitcher />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, borderBottomColor: colors.border }]}>{t('settings.support')}</Text>
          {renderSettingItem(
            'help-circle-outline',
            t('settings.helpSupport'),
            t('settings.helpDescription'),
            () => Alert.alert(t('common.comingSoon'), t('settings.comingSoon'))
          )}
          {renderSettingItem(
            'information-circle-outline',
            t('settings.about'),
            t('settings.versionInfo', { version: '1.0.0' }),
            () => Alert.alert(t('settings.about'), t('settings.aboutDescription'))
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          {renderSettingItem(
            'log-out-outline',
            t('common.logout'),
            t('settings.logoutDescription'),
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
  },
  headerContainer: {
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
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
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
    padding: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
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
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
});

export default SettingsScreen;
