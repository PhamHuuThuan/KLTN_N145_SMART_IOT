import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { useNotificationContext } from './src/contexts/NotificationContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import './src/i18n'; // Initialize i18n
import EmergencyScreen from './src/screens/EmergencyScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RulesScreen from './src/screens/RulesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SupportChatScreen from './src/screens/SupportChatScreen';
import UserGuideScreen from './src/screens/UserGuideScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
import SensorChartScreen from './src/screens/SensorChartScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import VerifyResetCodeScreen from './src/screens/VerifyResetCodeScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import CONFIG from './src/constants/config';
import apiService from './src/services/apiService';
import rulesService from './src/services/rulesService';

function AppContent() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();
  const { emergency, markAllAsRead, loadNotifications, dispatch } = useNotificationContext?.() || {};
  const [activeTab, setActiveTab] = useState('Home');
  const [currentScreen, setCurrentScreen] = useState('Main');
  const [nativeEmergency, setNativeEmergency] = useState(null);
  const [navigationParams, setNavigationParams] = useState({});

  // Reset to Home tab when user becomes authenticated (login success)
  useEffect(() => {
    if (isAuthenticated && currentScreen === 'Main') {
      setActiveTab('Home');
    }
  }, [isAuthenticated, currentScreen]);

  // Listen to native EmergencyActivity intent events
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('EmergencyIntent', (data) => {
      const action = data?.emergencyAction;
      const deviceId = data?.deviceId;
      const deviceName = data?.deviceName;
      if (action === 'activate_emergency' && deviceId) {
        setNativeEmergency({ deviceId, deviceName });
        // Trigger the same flow as overlay
        handleActivateEmergencyFromNative(deviceId);
      } else if (action === 'inspect_device') {
        setCurrentScreen('Main');
        setActiveTab('Home');
      }
    });
    return () => { try { sub.remove(); } catch {} };
  }, []);

  const handleActivateEmergencyFromNative = async (deviceId) => {
    try {
      await apiService.enterEmergencyMode(deviceId);
      // Show success notification
      if (dispatch) {
        dispatch({ 
          type: 'ADD_NOTIFICATION', 
          payload: {
            id: `emergency-activated-${Date.now()}`,
            title: 'Chế độ khẩn cấp',
            message: 'Đã bật chế độ khẩn cấp thành công',
            type: 'system_notification',
            category: 'system',
            priority: 'normal',
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { deviceId, action: 'emergency_activated' }
          }
        });
      }
    } catch (_) {
    } finally {
      if (dispatch) {
        dispatch({ type: 'SET_EMERGENCY', payload: null });
      }
    }
  };

  const renderScreen = () => {
    if (!isAuthenticated) {
      switch (currentScreen) {
        case 'Login':
          return <LoginScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
        case 'Register':
          return <RegisterScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
        case 'ForgotPassword':
          return <ForgotPasswordScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
        case 'VerifyResetCode':
          return <VerifyResetCodeScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('ForgotPassword') }} />;
        case 'ResetPassword':
          return <ResetPasswordScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('VerifyResetCode') }} />;
        default:
          return <LoginScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
      }
    }

    // Reset to Main screen and Home tab when authenticated (fix for registration/login redirect issue)
    if (
      currentScreen !== 'Main' &&
      ![
        'Notifications',
        'NotificationSettingsFromNotifications',
        'NotificationSettingsFromSettings',
        'Profile',
        'ChangePassword',
        'ForgotPassword',
        'VerifyResetCode',
        'ResetPassword',
        'SensorChart',
        'SupportChat',
        'UserGuide'
      ].includes(currentScreen)
    ) {
      setCurrentScreen('Main');
      setActiveTab('Home'); // Always go to Home tab after login
    }

    switch (currentScreen) {
      case 'Main':
        switch (activeTab) {
          case 'Home':
            return <HomeScreen navigation={{ 
              navigate: (screen, params) => {
                if (params) setNavigationParams(params);
                setCurrentScreen(screen);
              }, 
              goBack: () => setCurrentScreen('Main') 
            }} />;
          case 'Chat':
            return <ChatScreen onNavigateToHome={() => setActiveTab('Home')} />;
          case 'Rules':
            return <RulesScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
          case 'Settings':
            return <SettingsScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
          default:
            return <HomeScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
        }
      case 'Notifications':
        return <NotificationScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
      case 'NotificationSettingsFromNotifications':
        return <NotificationSettingsScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Notifications') }} />;
      case 'NotificationSettingsFromSettings':
        return <NotificationSettingsScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Settings') }} />;
      case 'Profile':
        return <ProfileScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
      case 'ChangePassword':
        return <ChangePasswordScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
      case 'SensorChart':
        return <SensorChartScreen 
          navigation={{ 
            navigate: (screen, params) => {
              if (params) setNavigationParams(params);
              setCurrentScreen(screen);
            }, 
            goBack: () => setCurrentScreen('Main') 
          }}
          route={{ params: navigationParams }}
        />;
      case 'SupportChat':
        return (
          <SupportChatScreen
            navigation={{
              navigate: setCurrentScreen,
              goBack: () => setCurrentScreen('Settings')
            }}
          />
        );
      case 'UserGuide':
        return (
          <UserGuideScreen
            navigation={{
              navigate: setCurrentScreen,
              goBack: () => setCurrentScreen('Settings')
            }}
          />
        );
      default:
        return <HomeScreen />;
    }
  };

  const handleCheckNow = async () => {
    setCurrentScreen('Main');
    setActiveTab('Home');
    if (dispatch) {
      dispatch({ type: 'SET_EMERGENCY', payload: null });
    }
  };

  const handleActivateEmergency = async () => {
    try {
      const deviceId = emergency?.metadata?.deviceId;
      if (deviceId) {
        await apiService.enterEmergencyMode(deviceId);
        // Show success notification
        if (dispatch) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: `emergency-activated-${Date.now()}`,
            title: 'Chế độ khẩn cấp',
            message: 'Đã bật chế độ khẩn cấp thành công',
            type: 'system_notification',
            category: 'system',
            priority: 'normal',
            isRead: false,
            createdAt: new Date().toISOString(),
            metadata: { deviceId, action: 'emergency_activated' }
          }
        });
        }
      }
    } catch (e) {
      // Swallow error; UI will still return to app
    } finally {
      setCurrentScreen('Main');
      setActiveTab('Home');
      if (dispatch) {
        dispatch({ type: 'SET_EMERGENCY', payload: null });
      }
    }
  };

  const handleDismissEmergency = async () => {
    if (dispatch) {
      dispatch({ type: 'SET_EMERGENCY', payload: null });
    }
  };

  const TabButton = ({ label, icon, isActive, onPress }) => (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.8}>
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={isActive ? colors.primary : colors.gray}
      />
      <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.gray }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.primary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>{renderScreen()}</View>
      
      {isAuthenticated && currentScreen === 'Main' && (
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TabButton
            label={t('navigation.home')}
            icon="home"
            isActive={activeTab === 'Home'}
            onPress={() => setActiveTab('Home')}
          />
          <TabButton
            label={t('navigation.chat')}
            icon="chat"
            isActive={activeTab === 'Chat'}
            onPress={() => setActiveTab('Chat')}
          />
          <TabButton
            label={t('navigation.rules')}
            icon="tune"
            isActive={activeTab === 'Rules'}
            onPress={() => setActiveTab('Rules')}
          />
          <TabButton
            label={t('navigation.settings')}
            icon="cog"
            isActive={activeTab === 'Settings'}
            onPress={() => setActiveTab('Settings')}
          />
        </View>
      )}

      {isAuthenticated && emergency && (
        <View style={styles.overlay}>
          <EmergencyScreen
            emergency={emergency}
            onCheckNow={handleCheckNow}
            onActivateEmergency={handleActivateEmergency}
            onDismiss={handleDismissEmergency}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
});
