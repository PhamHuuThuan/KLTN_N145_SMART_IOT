import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import CONFIG from '../constants/config';
import { useAuth } from '../contexts/AuthContext';
import ActionFeedback from '../components/ActionFeedback';

const ChangePasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { changePassword, isLoading } = useAuth();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  const onSubmit = async () => {
    // Validation
    if (!passwords.currentPassword.trim()) {
      setFeedback({ visible: true, type: 'error', message: t('profile.currentPasswordRequired') });
      return;
    }
    if (!passwords.newPassword.trim()) {
      setFeedback({ visible: true, type: 'error', message: t('profile.newPasswordRequired') });
      return;
    }
    if (!passwords.confirmPassword.trim()) {
      setFeedback({ visible: true, type: 'error', message: t('profile.confirmPasswordRequired') });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setFeedback({ visible: true, type: 'error', message: t('auth.passwordMismatch') });
      return;
    }
    if (passwords.newPassword.length < 6) {
      setFeedback({ visible: true, type: 'error', message: t('auth.passwordTooShort') });
      return;
    }
    
    try {
      const result = await changePassword(passwords.currentPassword, passwords.newPassword);
      if (result.success) {
        setFeedback({ visible: true, type: 'success', message: t('profile.passwordChanged') });
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowCurrent(false); setShowNew(false); setShowConfirm(false);
      } else {
        let errorMessage = result?.error || t('profile.passwordChangeError');
        // Map error messages to translation keys
        if (errorMessage === 'Mật khẩu hiện tại không đúng') {
          errorMessage = t('profile.currentPasswordIncorrect');
        } else if (errorMessage === 'Mật khẩu mới phải có ít nhất 6 ký tự') {
          errorMessage = t('auth.passwordTooShort');
        } else if (errorMessage === 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới') {
          errorMessage = t('profile.currentPasswordRequired') + ' và ' + t('profile.newPasswordRequired');
        } else if (errorMessage === 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại') {
          errorMessage = t('auth.authenticationFailed');
        }
        setFeedback({ visible: true, type: 'error', message: errorMessage });
      }
    } catch (error) {
      setFeedback({ visible: true, type: 'error', message: t('profile.passwordChangeError') });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.changePassword')}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={[styles.card, styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.changePassword')}</Text>

        <Text style={[styles.label, { color: colors.text }]}>{t('profile.currentPassword')}</Text>
        <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            value={passwords.currentPassword}
            onChangeText={(text) => setPasswords({ ...passwords, currentPassword: text })}
            placeholder={t('profile.enterCurrentPassword')}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showCurrent}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrent(!showCurrent)}>
            <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={colors.gray} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>{t('profile.newPassword')}</Text>
        <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            value={passwords.newPassword}
            onChangeText={(text) => setPasswords({ ...passwords, newPassword: text })}
            placeholder={t('profile.enterNewPassword')}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showNew}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew(!showNew)}>
            <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={colors.gray} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>{t('profile.confirmNewPassword')}</Text>
        <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            value={passwords.confirmPassword}
            onChangeText={(text) => setPasswords({ ...passwords, confirmPassword: text })}
            placeholder={t('profile.enterConfirmPassword')}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showConfirm}
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm(!showConfirm)}>
            <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.gray} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onSubmit}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>{t('profile.changePassword')}</Text>
        </TouchableOpacity>
      </View>
      <ActionFeedback 
        visible={feedback.visible} 
        type={feedback.type} 
        message={feedback.message} 
        onHide={() => setFeedback({ ...feedback, visible: false })} 
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1
  },
  header: { 
    paddingTop: 40, 
    paddingHorizontal: 16, 
    paddingBottom: 16 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  backButton: { 
    padding: 8 
  },
  headerTitle: { 
    color: CONFIG.COLORS.white, 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  section: { 
    padding: CONFIG.DIMENSIONS.cardPadding, 
    borderRadius: CONFIG.DIMENSIONS.borderRadius, 
    margin: 16 
  },
  card: {
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    elevation: 4,
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    marginBottom: 12 
  },
  label: { 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 6, 
    marginTop: 8 
  },
  passwordRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderRadius: CONFIG.DIMENSIONS.borderRadius
  },
  passwordInput: { 
    flex: 1, 
    padding: 12, 
    fontSize: 16 
  },
  eyeButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 10 
  },
  button: { 
    marginTop: 16, 
    padding: 12, 
    borderRadius: CONFIG.DIMENSIONS.borderRadius, 
    alignItems: 'center' 
  },
  buttonText: { 
    color: CONFIG.COLORS.white, 
    fontSize: 16, 
    fontWeight: '600' 
  },
});

export default ChangePasswordScreen;
