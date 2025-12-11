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

const log = createLogger('Login');

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setFeedback({ visible: true, type: 'error', message: 'Vui lòng nhập email và mật khẩu' });
      return;
    }

    if (!isValidEmail(email)) {
      setFeedback({ visible: true, type: 'error', message: 'Email không hợp lệ' });
      return;
    }

    try {
      setIsLoading(true);
      setShowLoader(true);
      const result = await login(email.trim(), password);
      
      setIsLoading(false);
      setShowLoader(false);
      
      if (result.success) {
        log.info('Login successful');
        setFeedback({ visible: true, type: 'success', message: 'Đăng nhập thành công' });
      } else {
        setFeedback({ visible: false, type: 'error', message: '' });
        
        setTimeout(() => {
          const errorMessage = result.error || 'Đăng nhập thất bại';
          setFeedback({ visible: true, type: 'error', message: errorMessage });
        }, 100);
      }
    } catch (error) {
      setIsLoading(false);
      setShowLoader(false);
      setFeedback({ visible: true, type: 'error', message: 'Đăng nhập thất bại' });
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('common.password')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={true}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={CONFIG.COLORS.gray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={CONFIG.COLORS.white} />
              ) : (
                <Text style={styles.loginButtonText}>{t('auth.signIn')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth.dontHaveAccount')} </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={isLoading}
              >
                <Text style={styles.linkText}>{t('auth.signUp')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <OverlayLoader visible={showLoader} message={t('common.loading')} onCancel={() => setShowLoader(false)} />
      <ActionFeedback visible={feedback.visible} type={feedback.type} message={feedback.message} onHide={() => setFeedback({ ...feedback, visible: false })} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.THEME.background,
  },
  header: {
    backgroundColor: CONFIG.COLORS.primary,
    padding: 20,
    paddingTop: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: CONFIG.COLORS.white,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: CONFIG.COLORS.light,
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
  loginButton: {
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
  loginButtonText: {
    color: CONFIG.COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    color: CONFIG.THEME.primary,
    fontSize: 16,
    fontWeight: '600',
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

export default LoginScreen;
