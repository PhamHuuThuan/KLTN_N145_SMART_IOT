import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import ChatMessageList from '../components/ChatMessageList';
import ChatInput from '../components/ChatInput';
import VoiceCommandsHelp from '../components/VoiceCommandsHelp';
import ChatDeviceSelector from '../components/ChatDeviceSelector';
import OutletDetail from '../components/OutletDetail';
import useSpeechToText from '../hooks/useSpeechToText';
import useVoiceControl from '../hooks/useVoiceControl';
import { useOutletControl } from '../hooks/useOutletControl';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('Chat');

const ChatScreen = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const myId = 'me';
  const [messages, setMessages] = useState(() => [
    { 
      id: 'm1', 
      userId: 'bot', 
      text: t('chat.welcome'), 
      time: Date.now() - 60000 
    },
    { 
      id: 'm2', 
      userId: 'bot', 
      text: t('chat.voiceCommandsHelp'), 
      time: Date.now() - 30000 
    },
  ]);
  
  // Device and outlet control state
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Outlet detail modal state
  const [showOutletDetail, setShowOutletDetail] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);

  const { parseVoiceCommand, executeVoiceCommand, processTranscript } = useVoiceControl();
  const { controlOutlet: controlOutletHook } = useOutletControl();

  // Load devices on component mount
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDevices();
      if (response.success) {
        setDevices(response.data || []);
        // Auto-select first device if available
        if (response.data && response.data.length > 0) {
          const firstDevice = response.data[0];
          log.info('Auto-selecting first device:', firstDevice);
          setSelectedDevice(firstDevice);
        }
      } else {
        log.error('Failed to load devices:', response.message);
      }
    } catch (error) {
      log.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (text) => {
    const msg = { id: `m_${Date.now()}`, userId: myId, text, time: Date.now() };
    setMessages((prev) => [...prev, msg]);
    log.debug('send message', text);
    
    // Process voice command if it's a command
    const command = processTranscript(text);
    if (command && command.action) {
      handleVoiceCommand(command);
    }
  };

  const handleVoiceCommand = async (command) => {
    try {
      const result = await executeVoiceCommand(command, handleOutletControl);
      
      // Add bot response
      const botMsg = { 
        id: `bot_${Date.now()}`, 
        userId: 'bot', 
        text: result.message, 
        time: Date.now() 
      };
      setMessages((prev) => [...prev, botMsg]);

      // If command failed, add helpful guidance
      if (!result.success) {
        const helpMsg = {
          id: `help_${Date.now()}`,
          userId: 'bot',
          text: getErrorGuidance(result.message),
          time: Date.now()
        };
        setTimeout(() => {
          setMessages((prev) => [...prev, helpMsg]);
        }, 1000);
      }
    } catch (error) {
      log.error('Error handling voice command:', error);
      const errorMsg = {
        id: `error_${Date.now()}`,
        userId: 'bot',
        text: t('voice.commandError'),
        time: Date.now()
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const getErrorGuidance = (errorMessage) => {
    if (errorMessage.includes('noDeviceSelected')) {
      return t('chat.guidance.selectDevice');
    } else if (errorMessage.includes('commandNotUnderstood')) {
      return t('chat.guidance.tryCommands');
    } else if (errorMessage.includes('commandFailed')) {
      return t('chat.guidance.checkDevice');
    } else {
      return t('chat.guidance.general');
    }
  };

  const handleOutletControl = async (action, outletId) => {
    const deviceId = selectedDevice?.deviceId;
    
    if (!selectedDevice || !deviceId) {
      const errorMsg = { 
        id: `bot_${Date.now()}`, 
        userId: 'bot', 
        text: t('chat.noDeviceSelected'), 
        time: Date.now() 
      };
      setMessages((prev) => [...prev, errorMsg]);
      return false;
    }

    try {
      log.info('Voice outlet control:', { action, outletId, deviceId });
      
      let success = false;
      let controlledOutlet = null;
      
      if (outletId === 'all') {
        // Control all outlets
        success = await controlAllOutlets(action);
      } else {
        // Control specific outlet
        const result = await controlOutlet(outletId, action);
        success = result.success;
        controlledOutlet = result.outlet;
      }
      
      // Add success/failure message with outlet card
      if (success && controlledOutlet) {
        const successMsg = { 
          id: `bot_${Date.now()}`, 
          userId: 'bot', 
          text: `${action === 'on' ? t('chat.outletTurnedOn') : t('chat.outletTurnedOff')}: ${controlledOutlet.name}`,
          outletCard: controlledOutlet,
          time: Date.now() 
        };
        setMessages((prev) => [...prev, successMsg]);
      } else if (!success) {
        const errorMsg = { 
          id: `bot_${Date.now()}`, 
          userId: 'bot', 
          text: t('chat.outletControlFailed'),
          time: Date.now() 
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
      
      return success;
    } catch (error) {
      log.error('Error controlling outlet:', error);
      return false;
    }
  };

  const controlOutlet = async (outletId, action) => {
    try {
      const deviceId = selectedDevice?.deviceId;
      
      // Get device details first to find outlet info
      const deviceResponse = await apiService.getDeviceDetail(deviceId);
      if (!deviceResponse.success || !deviceResponse.data?.outlets) {
        log.error('Failed to get device details');
        return { success: false };
      }
      
      const outlets = deviceResponse.data.outlets;
      let actualOutletId = outletId;
      let currentOutlet = null;
      
      // If it's a named outlet (e.g., fan_1, light, tv), try to find the actual outlet
      if (!outletId.startsWith('outlet_') && outletId !== 'all') {
        // Try to find outlet by exact name match first
        let foundOutlet = outlets.find(outlet => 
          outlet.name === outletId || outlet.id === outletId
        );
        
        // If not found, try partial name match
        if (!foundOutlet) {
          foundOutlet = outlets.find(outlet => 
            outlet.name?.toLowerCase().includes(outletId.toLowerCase()) ||
            outletId.toLowerCase().includes(outlet.name?.toLowerCase())
          );
        }
        
        // If still not found, try to find by device type keywords
        if (!foundOutlet) {
          const deviceKeywords = {
            'fan': ['quạt', 'fan'],
            'light': ['đèn', 'light', 'led'],
            'tv': ['tivi', 'tv', 'television'],
            'ac': ['điều hòa', 'air conditioner', 'ac'],
            'refrigerator': ['tủ lạnh', 'refrigerator', 'fridge'],
            'microwave': ['lò vi sóng', 'microwave'],
            'washing': ['máy giặt', 'washing machine'],
            'heater': ['bình nóng lạnh', 'heater', 'water heater']
          };
          
          const keywords = deviceKeywords[outletId] || [];
          foundOutlet = outlets.find(outlet => 
            keywords.some(keyword => 
              outlet.name?.toLowerCase().includes(keyword)
            )
          );
        }
        
        if (foundOutlet) {
          actualOutletId = foundOutlet.id;
          currentOutlet = foundOutlet;
          log.info(`Found outlet: ${outletId} -> ${foundOutlet.id} (${foundOutlet.name})`);
        } else {
          log.warn(`Outlet not found: ${outletId}. Available outlets:`, outlets.map(o => `${o.id}:${o.name}`));
          return { success: false };
        }
      } else {
        // For direct outlet IDs, find the outlet
        currentOutlet = outlets.find(o => o.id === actualOutletId);
        if (!currentOutlet) {
          log.error(`Outlet ${actualOutletId} not found in device outlets`);
          return { success: false };
        }
      }

      // Use the same hook as HomeScreen
      const success = await controlOutletHook(action, deviceId, actualOutletId);
      
      if (success) {
        log.info(`Successfully ${action} ${outletId} (${actualOutletId}) on device ${deviceId}`);
        return { success: true, outlet: currentOutlet };
      } else {
        log.error('Failed to control outlet');
        return { success: false };
      }
    } catch (error) {
      log.error('Error controlling outlet:', error);
      return { success: false };
    }
  };

  const controlAllOutlets = async (action) => {
    try {
      // Use device.id (not _id) for API calls
      const deviceId = selectedDevice?.deviceId;
      // Get device outlets first
      const deviceResponse = await apiService.getDeviceDetail(deviceId);
      if (!deviceResponse.success || !deviceResponse.data?.outlets) {
        return false;
      }

      const outlets = deviceResponse.data.outlets;
      let allSuccess = true;

      // Control each outlet - toggle all to the desired state
      for (const outlet of outlets) {
        // If outlet is already in desired state, skip
        if ((action === 'on' && outlet.status) || (action === 'off' && !outlet.status)) {
          continue;
        }
        
        // Toggle outlet to change its state
        const success = await controlOutlet(outlet.id, action);
        if (!success) {
          allSuccess = false;
        }
      }

      return allSuccess;
    } catch (error) {
      log.error('Error controlling all outlets:', error);
      return false;
    }
  };

  const { listening, transcript, toggle } = useSpeechToText({
    locale: 'vi-VN',
    onResult: undefined,
  });

  const [compose, setCompose] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  
  useEffect(() => {
    // bind transcript to input when listening
    if (transcript && transcript !== compose) {
      setCompose(transcript);
    }
    log.info("Listening.transcript", transcript);
  }, [transcript]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: 'padding' })}
        keyboardVerticalOffset={Platform.select({ ios: 60, android: 30 })}
      >
        <View style={[styles.frame, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
            <Text style={[styles.headerTitle, { color: colors.primary }]}>Chat</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={[styles.deviceButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowDeviceSelector(true)}
              >
                <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
                <Text style={[styles.deviceButtonText, { color: colors.text }]} numberOfLines={1}>
                  {selectedDevice ? selectedDevice.name || selectedDevice.id : t('chat.selectDevice')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={() => setShowHelp(true)}
              >
                <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.messagesArea}>
            <ChatMessageList 
              messages={messages} 
              userId={myId} 
              onOutletPress={(outlet) => {
                setSelectedOutlet(outlet);
                setShowOutletDetail(true);
              }}
            />
          </View>
          <ChatInput
            onSend={(t) => { handleSend(t); setCompose(''); }}
            onVoiceToggle={toggle}
            listening={listening}
            value={compose}
            onChangeText={setCompose}
          />
        </View>
      </KeyboardAvoidingView>
      
      <VoiceCommandsHelp 
        visible={showHelp} 
        onClose={() => setShowHelp(false)} 
      />
      
      <ChatDeviceSelector
        visible={showDeviceSelector}
        onClose={() => setShowDeviceSelector(false)}
        onDeviceSelect={setSelectedDevice}
        selectedDevice={selectedDevice}
      />
      
      <OutletDetail
        visible={showOutletDetail}
        onClose={() => setShowOutletDetail(false)}
        outlet={selectedOutlet}
        deviceId={selectedDevice?.id}
        onOutletUpdate={() => {
          // Refresh device data after outlet update
          loadDevices();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  frame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: 120,
  },
  deviceButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  helpButton: {
    padding: 4,
  },
  messagesArea: {
    flex: 1,
  },
});

export default ChatScreen;


