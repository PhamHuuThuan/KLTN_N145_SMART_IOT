import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import ActionFeedback from './ActionFeedback';

const ThemeSwitcher = ({ style }) => {
  const { t } = useTranslation();
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleThemeToggle = async () => {
    try {
      await toggleTheme();
      const message = isDarkMode 
        ? t('settings.themeChangedToLight') 
        : t('settings.themeChangedToDark');
      setFeedbackMessage(message);
      setFeedbackVisible(true);
    } catch (error) {
      setFeedbackMessage(t('settings.themeChangeError'));
      setFeedbackVisible(true);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.themeButton, { borderBottomColor: colors.border }]}
        onPress={handleThemeToggle}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons 
              name={isDarkMode ? "sunny-outline" : "moon-outline"} 
              size={24} 
              color={colors.primary} 
            />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              {t('settings.darkMode')}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
              {isDarkMode ? t('settings.darkModeOn') : t('settings.darkModeOff')}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray} />
      </TouchableOpacity>

      <ActionFeedback
        type="success"
        message={feedbackMessage}
        visible={feedbackVisible}
        onHide={() => setFeedbackVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Will be set by parent
  },
  themeButton: {
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

export default ThemeSwitcher;
