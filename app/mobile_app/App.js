import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CONFIG from './src/constants/config';

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'Home':
        return <HomeScreen />;
      case 'Chat':
        return <ChatScreen />;
      case 'Profile':
        return <ProfileScreen />;
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
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
          label="Profile"
          icon="account"
          isActive={activeTab === 'Profile'}
          onPress={() => setActiveTab('Profile')}
        />
      </View>
    </SafeAreaView>
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