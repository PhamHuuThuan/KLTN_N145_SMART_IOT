import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
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
import chatSessionManager from '../services/chatSessionManager';
import { createLogger } from '../utils/logger';

const log = createLogger('Chat');

const ChatScreen = ({ onNavigateToHome }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const myId = 'me';
  const [messages, setMessages] = useState([]);
  
  // Device and outlet control state
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Outlet detail modal state
  const [showOutletDetail, setShowOutletDetail] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState('');
  const [skipVoiceSend, setSkipVoiceSend] = useState(false);

  const { parseVoiceCommand, executeVoiceCommand, processTranscript } = useVoiceControl();
  const { controlOutlet: controlOutletHook } = useOutletControl();

  // Load devices and messages on component mount
  useEffect(() => {
    loadDevices();
    if (user?.id) {
      loadChatSession();
    }
  }, [user?.id]);

  // Load chat session
  const loadChatSession = async () => {
    try {
      // Get current user ID from auth context
      const userId = user?.id;
      if (!userId) {
        log.warn('No user ID available for chat session');
        return;
      }
      
      // Initialize session and load messages
      const sessionId = await chatSessionManager.initializeSessionOnLogin(userId);
      if (sessionId) {
        const savedMessages = await chatSessionManager.loadMessages(sessionId);
        setMessages(savedMessages);
        log.info('Loaded chat session:', sessionId, 'with', savedMessages.length, 'messages');
      }
    } catch (error) {
      log.error('Error loading chat session:', error);
      // Fallback to default messages
      setMessages([
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
    }
  };

  // Save messages to session
  const saveMessagesToSession = async (newMessages) => {
    try {
      await chatSessionManager.updateMessages(newMessages);
    } catch (error) {
      log.error('Error saving messages to session:', error);
    }
  };

  // Update messages and save to session
  const updateMessages = (messageUpdater) => {
    setMessages((prevMessages) => {
      const newMessages = typeof messageUpdater === 'function' 
        ? messageUpdater(prevMessages) 
        : messageUpdater;
      
      // Save to session asynchronously
      saveMessagesToSession(newMessages);
      
      return newMessages;
    });
  };

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
    updateMessages((prev) => [...prev, msg]);
    log.debug('send message', text);
    
    // Process voice command if it's a command
    const command = processTranscript(text);
    if (command && command.action) {
      handleVoiceCommand(command);
    }
  };

  const handleVoiceCommand = async (command) => {
    try {
      const result = await executeVoiceCommand(command, handleOutletControlSilent);
      
      // Add bot response
      const botMsg = { 
        id: `bot_${Date.now()}`, 
        userId: 'bot', 
        text: result.message, 
        outletCard: result.outlet || null,
        time: Date.now() 
      };
      log.info('Adding bot message:', { text: result.message, hasOutlet: !!result.outlet });
      updateMessages((prev) => {
        const newMessages = [...prev, botMsg];
        log.info('Updated messages count:', newMessages.length);
        return newMessages;
      });

      // If command failed, add helpful guidance
      if (!result.success) {
        const helpMsg = {
          id: `help_${Date.now()}`,
          userId: 'bot',
          text: getErrorGuidance(result.message),
          time: Date.now()
        };
        setTimeout(() => {
          updateMessages((prev) => [...prev, helpMsg]);
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
      updateMessages((prev) => [...prev, errorMsg]);
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

  // Silent version for voice command (doesn't add messages)
  const handleOutletControlSilent = async (action, outletId) => {
    const deviceId = selectedDevice?.deviceId;
    
    if (!selectedDevice || !deviceId) {
      return false;
    }

    try {
      log.info('Voice outlet control:', { action, outletId, deviceId });
      
      let success = false;
      let controlledOutlet = null;
      
      if (outletId === 'all') {
        // Control all outlets
        const result = await controlAllOutlets(action);
        success = result.success || result;
        controlledOutlet = result.outlet || null;
      } else {
        // Control specific outlet
        const result = await controlOutlet(outletId, action);
        success = result.success;
        controlledOutlet = result.outlet;
      }
      
      return { success, outlet: controlledOutlet };
    } catch (error) {
      log.error('Error controlling outlet:', error);
      return { success: false };
    }
  };

  // Version that adds messages (for direct calls)
  const handleOutletControl = async (action, outletId) => {
    const deviceId = selectedDevice?.deviceId;
    
    if (!selectedDevice || !deviceId) {
      const errorMsg = { 
        id: `bot_${Date.now()}`, 
        userId: 'bot', 
        text: t('chat.noDeviceSelected'), 
        time: Date.now() 
      };
      updateMessages((prev) => [...prev, errorMsg]);
      return false;
    }

    try {
      const result = await handleOutletControlSilent(action, outletId);
      
      // Add success/failure message with outlet card
      if (result.success && result.outlet) {
        const successMsg = { 
          id: `bot_${Date.now()}`, 
          userId: 'bot', 
          text: `${action === 'on' ? t('chat.outletTurnedOn') : t('chat.outletTurnedOff')}: ${result.outlet.name}`,
          outletCard: result.outlet,
          time: Date.now() 
        };
        updateMessages((prev) => [...prev, successMsg]);
      } else if (!result.success) {
        const errorMsg = { 
          id: `bot_${Date.now()}`, 
          userId: 'bot', 
          text: t('chat.outletControlFailed'),
          time: Date.now() 
        };
        updateMessages((prev) => [...prev, errorMsg]);
      }
      
      return result.success;
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
      
      // If it's a named outlet (e.g., fan_1, light, tv) or outlet ID (e.g., o1, o2), try to find the actual outlet
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
              outlet.name?.toLowerCase().includes(keyword.toLowerCase()) ||
              keyword.toLowerCase().includes(outlet.name?.toLowerCase())
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
        
        // Update outlet status based on action
        const updatedOutlet = {
          ...currentOutlet,
          status: action === 'on' ? true : action === 'off' ? false : !currentOutlet.status
        };
        
        return { success: true, outlet: updatedOutlet };
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
        return { success: false };
      }

      const outlets = deviceResponse.data.outlets;
      let allSuccess = true;
      let firstControlledOutlet = null;

      // Control each outlet - toggle all to the desired state
      for (const outlet of outlets) {
        // Always control outlet (useOutletControl will handle the toggle logic)
        const result = await controlOutlet(outlet.id, action);
        if (!result.success) {
          allSuccess = false;
        } else if (!firstControlledOutlet && result.outlet) {
          // Store first controlled outlet for display
          firstControlledOutlet = result.outlet;
        }
      }

      return { success: allSuccess, outlet: firstControlledOutlet };
    } catch (error) {
      log.error('Error controlling all outlets:', error);
      return { success: false };
    }
  };

  const { listening, transcript, toggle, stop } = useSpeechToText({
    locale: 'vi-VN',
  });

  const [compose, setCompose] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  
  useEffect(() => {
    if (transcript && transcript !== voiceDraft) {
      setVoiceDraft(transcript);
    }
  }, [transcript, voiceDraft]);

  useEffect(() => {
    if (listening) {
      setVoiceModalVisible(true);
    } else if (voiceModalVisible) {
      if (voiceDraft.trim() && !skipVoiceSend) {
        handleSend(voiceDraft.trim());
      }
      setVoiceDraft('');
      setVoiceModalVisible(false);
      setSkipVoiceSend(false);
    }
  }, [listening, voiceDraft, voiceModalVisible, skipVoiceSend]);

  const handleVoiceToggle = async () => {
    if (!listening) {
      setVoiceDraft('');
    setSkipVoiceSend(false);
      setVoiceModalVisible(true);
      await toggle(true);
    } else {
      await toggle(false);
    }
  };

  const handleVoiceCancel = async () => {
    setVoiceDraft('');
    setVoiceModalVisible(false);
  setSkipVoiceSend(true);
    await stop();
  };

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
                // Navigate to Home tab
                if (onNavigateToHome) {
                  onNavigateToHome();
                }
              }}
            />
          </View>
          <ChatInput
            onSend={(t) => { handleSend(t); setCompose(''); }}
            onVoiceToggle={handleVoiceToggle}
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

      <Modal
        visible={voiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleVoiceCancel}
      >
        <View style={styles.voiceModalBackdrop}>
          <View style={[styles.voiceModal, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.voiceClose} onPress={handleVoiceCancel}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[
              styles.voiceMicCircle,
              { backgroundColor: listening ? colors.primary : colors.border }
            ]}>
              <Ionicons
                name={listening ? 'mic' : 'mic-outline'}
                size={28}
                color={listening ? colors.white : colors.textSecondary}
              />
            </View>
            <Text style={[styles.voiceHint, { color: colors.textSecondary }]}>
              {listening
                ? t('chat.voiceListening', 'Đang ghi âm...')
                : t('chat.voicePreview', 'Đang gửi...')}
            </Text>
            <View style={styles.voiceTranscriptBox}>
              <Text style={[styles.voiceTranscript, { color: colors.text }]}>
                {voiceDraft || t('chat.voiceListeningPlaceholder', 'Nói nội dung bạn muốn gửi...')}
              </Text>
            </View>
            {listening && (
              <View style={styles.voiceActions}>
                <TouchableOpacity
                  style={[styles.voiceButton, styles.voiceSecondaryButton, { borderColor: colors.border }]}
                  onPress={handleVoiceCancel}
                >
                  <Text style={[styles.voiceButtonText, { color: colors.text }]}>
                    {t('common.cancel', 'Huỷ')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voiceButton, { backgroundColor: colors.primary }]}
                  onPress={() => toggle(false)}
                >
                  <Text style={[styles.voiceButtonText, { color: colors.white }]}>
                    {t('chat.voiceStop', 'Dừng')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  voiceModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  voiceModal: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  voiceMicCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  voiceHint: {
    fontSize: 14,
    marginBottom: 12,
  },
  voiceTranscriptBox: {
    width: '100%',
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    marginBottom: 16,
  },
  voiceTranscript: {
    fontSize: 16,
    textAlign: 'center',
  },
  voiceClose: {
    alignSelf: 'flex-end',
    padding: 6,
  },
  voiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  voiceButton: {
    minWidth: 90,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  voiceSecondaryButton: {
    borderWidth: 1,
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ChatScreen;


