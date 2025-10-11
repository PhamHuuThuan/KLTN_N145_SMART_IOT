import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../contexts/ThemeContext';
import ActionFeedback from './ActionFeedback';
import CONFIG from '../constants/config';

const LanguageSwitcher = ({ style }) => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, getAvailableLanguages, getCurrentLanguageInfo } = useLanguage();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState('success');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const languages = getAvailableLanguages();
  const currentLangInfo = getCurrentLanguageInfo();

  const handleLanguageChange = async (languageCode) => {
    try {
      await changeLanguage(languageCode);
      setModalVisible(false);
      
      // Show success feedback
      const languageName = languages.find(lang => lang.code === languageCode)?.nativeName;
      setFeedbackMessage(t('settings.languageChanged', { language: languageName }));
      setFeedbackType('success');
      setFeedbackVisible(true);
    } catch (error) {
      console.error('Error changing language:', error);
      setModalVisible(false);
      
      // Show error feedback
      setFeedbackMessage(t('settings.languageChangeError'));
      setFeedbackType('error');
      setFeedbackVisible(true);
    }
  };

  const renderLanguageItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        { borderBottomColor: colors.border },
        currentLanguage === item.code && { backgroundColor: colors.backgroundSecondary }
      ]}
      onPress={() => handleLanguageChange(item.code)}
    >
      <Text style={[
        styles.languageName,
        { color: colors.text },
        currentLanguage === item.code && { color: colors.primary }
      ]}>
        {item.nativeName}
      </Text>
      <Text style={[
        styles.languageCode,
        { color: colors.textSecondary },
        currentLanguage === item.code && { color: colors.primary }
      ]}>
        {item.name}
      </Text>
      {currentLanguage === item.code && (
        <Ionicons
          name="checkmark"
          size={20}
          color={colors.primary}
          style={styles.checkIcon}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.languageButton, { borderBottomColor: colors.border }]}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="language-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>{t('settings.language')}</Text>
            <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>
              {currentLangInfo.nativeName}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray} />
      </TouchableOpacity>

      <ActionFeedback
        type={feedbackType}
        message={feedbackMessage}
        visible={feedbackVisible}
        onHide={() => setFeedbackVisible(false)}
      />

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.selectLanguage')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.gray}
                />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={languages}
              keyExtractor={(item) => item.code}
              renderItem={renderLanguageItem}
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent', // Will be set by parent
  },
  languageButton: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: CONFIG.THEME.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
  },
  closeButton: {
    padding: 4,
  },
  languageList: {
    maxHeight: 300,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
  },
  selectedLanguageItem: {
    backgroundColor: CONFIG.THEME.background,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: CONFIG.COLORS.dark,
    flex: 1,
  },
  selectedLanguageName: {
    color: CONFIG.THEME.primary,
  },
  languageCode: {
    fontSize: 14,
    color: CONFIG.THEME.gray,
    marginRight: 8,
  },
  selectedLanguageCode: {
    color: CONFIG.THEME.primary,
  },
  checkIcon: {
    marginLeft: 8,
  },
});

export default LanguageSwitcher;
