import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { createLogger } from '../utils/logger';
import CONFIG from '../constants/config';
import Header from '../components/Header';
import OverlayLoader from '../components/OverlayLoader';
import ActionFeedback from '../components/ActionFeedback';
import AsyncStorage from '@react-native-async-storage/async-storage';

const log = createLogger('ForgotPassword');

const ForgotPasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const { forgotPassword } = useAuth();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setFeedback({ visible: true, type: 'error', message: t('auth.emailRequired') });
      return;
    }

    if (!isValidEmail(email)) {
      setFeedback({ visible: true, type: 'error', message: t('auth.invalidEmail') });
      return;
    }

    try {
      setIsLoading(true);
      setShowLoader(true);
      const result = await forgotPassword(email.trim());
      
      if (result.success) {
        log.info('Forgot password request sent successfully');
        setFeedback({ 
          visible: true, 
          type: 'success', 
          message: 'Mã xác nhận đã được gửi đến email của bạn' 
        });
        
        // Navigate to verify code screen after 2 seconds
        setTimeout(async () => {
          await AsyncStorage.setItem('resetEmail', email.trim());
          navigation.navigate('VerifyResetCode');
        }, 2000);
      } else {
        setFeedback({ visible: true, type: 'error', message: result.error || 'Có lỗi xảy ra' });
      }
    } catch (error) {
      setFeedback({ visible: true, type: 'error', message: 'Có lỗi xảy ra' });
    } finally {
      setIsLoading(false);
      setShowLoader(false);
    }
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={CONFIG.THEME.primary} />
      <Header />
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.form}>
            <View style={styles.headerSection}>
              <Ionicons name="lock-closed" size={48} color={CONFIG.THEME.primary} style={styles.icon} />
              <Text style={styles.title}>Quên mật khẩu?</Text>
              <Text style={styles.subtitle}>
                Nhập email của bạn để nhận mã xác nhận đặt lại mật khẩu
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('common.email')}</Text>
              <TextInput
                style={[styles.input, { color: CONFIG.COLORS.dark }]}
                placeholder="Nhập email"
                placeholderTextColor={CONFIG.COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={true}
                selectionColor={CONFIG.THEME.primary}
                caretHidden={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={CONFIG.COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Gửi mã xác nhận</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Nhớ mật khẩu? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                disabled={isLoading}
              >
                <Text style={styles.linkText}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <OverlayLoader visible={showLoader} message="Đang gửi mã xác nhận..." onCancel={() => setShowLoader(false)} />
      <ActionFeedback visible={feedback.visible} type={feedback.type} message={feedback.message} onHide={() => setFeedback({ ...feedback, visible: false })} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  form: {
    backgroundColor: CONFIG.THEME.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginHorizontal: 4,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: CONFIG.COLORS.dark,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: CONFIG.THEME.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  submitButton: {
    backgroundColor: CONFIG.THEME.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: CONFIG.THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: CONFIG.THEME.gray,
  },
  submitButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: CONFIG.THEME.border,
  },
  footerText: {
    fontSize: 16,
    color: CONFIG.THEME.gray,
  },
  linkText: {
    fontSize: 16,
    color: CONFIG.THEME.primary,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;
