import React, { useState, useEffect } from 'react';
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

const log = createLogger('ResetPassword');

const ResetPasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const { resetPassword } = useAuth();

  useEffect(() => {
    // Load email and code from storage
    const loadData = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem('resetEmail');
        const storedCode = await AsyncStorage.getItem('resetCode');
        if (storedEmail) setEmail(storedEmail);
        if (storedCode) setCode(storedCode);
      } catch (error) {
        log.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setFeedback({ visible: true, type: 'error', message: 'Vui lòng nhập đầy đủ thông tin' });
      return;
    }

    if (newPassword.length < 6) {
      setFeedback({ visible: true, type: 'error', message: 'Mật khẩu phải có ít nhất 6 ký tự' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({ visible: true, type: 'error', message: 'Mật khẩu xác nhận không khớp' });
      return;
    }

    try {
      setIsLoading(true);
      setShowLoader(true);
      const result = await resetPassword(email, code, newPassword);
      
      // Hide loader first
      setIsLoading(false);
      setShowLoader(false);
      
      if (result.success) {
        log.info('Password reset successfully');
        setFeedback({ 
          visible: true, 
          type: 'success', 
          message: 'Đặt lại mật khẩu thành công!' 
        });
        
        // Navigate to login screen after 2 seconds
        setTimeout(async () => {
          // Clear stored data
          await AsyncStorage.removeItem('resetEmail');
          await AsyncStorage.removeItem('resetCode');
          navigation.navigate('Login');
        }, 2000);
      } else {
        setFeedback({ visible: true, type: 'error', message: result.error || 'Có lỗi xảy ra' });
      }
    } catch (error) {
      setIsLoading(false);
      setShowLoader(false);
      setFeedback({ visible: true, type: 'error', message: 'Có lỗi xảy ra' });
    }
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
              <Ionicons name="key" size={48} color={CONFIG.THEME.primary} style={styles.icon} />
              <Text style={styles.title}>Đặt lại mật khẩu</Text>
              <Text style={styles.subtitle}>
                Nhập mật khẩu mới cho tài khoản của bạn
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mật khẩu mới</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu mới"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={CONFIG.COLORS.gray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Xác nhận mật khẩu</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={CONFIG.COLORS.gray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Yêu cầu mật khẩu:</Text>
              <Text style={styles.requirement}>• Ít nhất 6 ký tự</Text>
              <Text style={styles.requirement}>• Nên bao gồm chữ hoa, chữ thường và số</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={CONFIG.COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Đặt lại mật khẩu</Text>
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
      <OverlayLoader visible={showLoader} message="Đang đặt lại mật khẩu..." onCancel={() => setShowLoader(false)} />
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
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: 12,
    padding: 16,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: CONFIG.THEME.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  passwordRequirements: {
    backgroundColor: CONFIG.COLORS.light,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    marginBottom: 4,
  },
  requirement: {
    fontSize: 12,
    color: CONFIG.COLORS.gray,
    marginBottom: 2,
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

export default ResetPasswordScreen;
