import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RulesScreen from './src/screens/RulesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import CONFIG from './src/constants/config';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');
  const [currentScreen, setCurrentScreen] = useState('Main');

  const renderScreen = () => {
    if (!isAuthenticated) {
      switch (currentScreen) {
        case 'Login':
          return <LoginScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
        case 'Register':
          return <RegisterScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
        default:
          return <LoginScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Login') }} />;
      }
    }

    switch (currentScreen) {
      case 'Main':
        switch (activeTab) {
          case 'Home':
            return <HomeScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
          case 'Chat':
            return <ChatScreen />;
          case 'Rules':
            return <RulesScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
          case 'Settings':
            return <SettingsScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
          default:
            return <HomeScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
        }
      case 'Notifications':
        return <NotificationScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
      case 'Profile':
        return <ProfileScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
      case 'ChangePassword':
        return <ChangePasswordScreen navigation={{ navigate: setCurrentScreen, goBack: () => setCurrentScreen('Main') }} />;
      default:
        return <HomeScreen />;
    }
  };

  const TabButton = ({ label, icon, isActive, onPress }) => (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.8}>
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={isActive ? CONFIG.THEME.primary : CONFIG.THEME.gray}
      />
      <Text style={[styles.tabLabel, { color: isActive ? CONFIG.THEME.primary : CONFIG.THEME.gray }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      
      {isAuthenticated && currentScreen === 'Main' && (
        <View style={styles.tabBar}>
          <TabButton
            label="Home"
            icon="home"
            isActive={activeTab === 'Home'}
            onPress={() => setActiveTab('Home')}
          />
          <TabButton
            label="Chat"
            icon="chat"
            isActive={activeTab === 'Chat'}
            onPress={() => setActiveTab('Chat')}
          />
          <TabButton
            label="Rules"
            icon="tune"
            isActive={activeTab === 'Rules'}
            onPress={() => setActiveTab('Rules')}
          />
          <TabButton
            label="Settings"
            icon="cog"
            isActive={activeTab === 'Settings'}
            onPress={() => setActiveTab('Settings')}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
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
    color: CONFIG.THEME.primary,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: CONFIG.THEME.surface,
    borderTopWidth: 1,
    borderTopColor: CONFIG.THEME.border,
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
