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

const log = createLogger('VerifyResetCode');

const VerifyResetCodeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const { verifyResetCode, forgotPassword } = useAuth();

  useEffect(() => {
    // Load email from storage
    const loadEmail = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem('resetEmail');
        if (storedEmail) {
          setEmail(storedEmail);
        }
      } catch (error) {
        log.error('Error loading email:', error);
      }
    };
    loadEmail();
  }, []);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setFeedback({ visible: true, type: 'error', message: 'Vui lòng nhập mã xác nhận' });
      return;
    }

    if (code.length !== 6) {
      setFeedback({ visible: true, type: 'error', message: 'Mã xác nhận phải có 6 chữ số' });
      return;
    }

    try {
      setIsLoading(true);
      setShowLoader(true);
      const result = await verifyResetCode(email, code.trim());
      
      // Hide loader first
      setIsLoading(false);
      setShowLoader(false);
      
      if (result.success) {
        log.info('Reset code verified successfully');
        setFeedback({ 
          visible: true, 
          type: 'success', 
          message: 'Mã xác nhận hợp lệ' 
        });
        
        // Navigate to reset password screen after 1 second
        setTimeout(async () => {
          await AsyncStorage.setItem('resetCode', code.trim());
          navigation.navigate('ResetPassword');
        }, 1000);
      } else {
        console.log('Verify code failed, result:', result); // Debug log
        // Force hide any existing feedback first
        setFeedback({ visible: false, type: 'error', message: '' });
        
        // Then set new feedback after a small delay
        setTimeout(() => {
          const errorMessage = result.error || 'Mã xác nhận không hợp lệ';
          console.log('Setting error message:', errorMessage); // Debug log
          setFeedback({ visible: true, type: 'error', message: errorMessage });
        }, 100);
      }
    } catch (error) {
      setIsLoading(false);
      setShowLoader(false);
      setFeedback({ visible: true, type: 'error', message: 'Có lỗi xảy ra' });
    }
  };

  const handleResendCode = async () => {
    try {
      setIsLoading(true);
      setShowLoader(true);
      const result = await forgotPassword(email);
      
      if (result.success) {
        setTimeLeft(900); // Reset timer to 15 minutes
        setCanResend(false);
        setFeedback({ 
          visible: true, 
          type: 'success', 
          message: 'Mã xác nhận mới đã được gửi' 
        });
      } else {
        setFeedback({ visible: true, type: 'error', message: result.error || 'Không thể gửi lại mã' });
      }
    } catch (error) {
      setFeedback({ visible: true, type: 'error', message: 'Có lỗi xảy ra' });
    } finally {
      setIsLoading(false);
      setShowLoader(false);
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
              <Ionicons name="mail" size={48} color={CONFIG.THEME.primary} style={styles.icon} />
              <Text style={styles.title}>Nhập mã xác nhận</Text>
              <Text style={styles.subtitle}>
                Chúng tôi đã gửi mã xác nhận 6 chữ số đến email:
              </Text>
              <Text style={styles.emailText}>{email}</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mã xác nhận</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập mã 6 chữ số"
                value={code}
                onChangeText={setCode}
                keyboardType="numeric"
                maxLength={6}
                editable={true}
                textAlign="center"
                fontSize={24}
                letterSpacing={4}
              />
            </View>

            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                Mã sẽ hết hạn sau: {formatTime(timeLeft)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleVerifyCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={CONFIG.COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Xác nhận</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendButton, (!canResend || isLoading) && styles.disabledButton]}
              onPress={handleResendCode}
              disabled={!canResend || isLoading}
            >
              <Text style={[styles.resendButtonText, (!canResend || isLoading) && styles.disabledText]}>
                Gửi lại mã xác nhận
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Không nhận được email? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={isLoading}
              >
                <Text style={styles.linkText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <OverlayLoader visible={showLoader} message="Đang xác nhận..." onCancel={() => setShowLoader(false)} />
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
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: CONFIG.THEME.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: CONFIG.COLORS.dark,
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: CONFIG.THEME.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: CONFIG.THEME.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    fontWeight: '500',
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
  resendButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: CONFIG.THEME.primary,
  },
  disabledButton: {
    backgroundColor: CONFIG.THEME.gray,
    borderColor: CONFIG.THEME.gray,
  },
  submitButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButtonText: {
    color: CONFIG.THEME.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    color: CONFIG.COLORS.gray,
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

export default VerifyResetCodeScreen;
