import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import CONFIG from '../constants/config';
import ChatMessageList from '../components/ChatMessageList';
import ChatInput from '../components/ChatInput';
import useSpeechToText from '../hooks/useSpeechToText';
import { createLogger } from '../utils/logger';

const log = createLogger('Chat');

const ChatScreen = () => {
  const myId = 'me';
  const [messages, setMessages] = useState(() => [
    { id: 'm1', userId: 'bot', text: 'Xin chào! Tôi có thể giúp gì cho bạn?', time: Date.now() - 60000 },
    { id: 'm2', userId: 'me', text: 'Mình cần hỗ trợ.', time: Date.now() - 30000 },
  ]);

  const handleSend = (text) => {
    const msg = { id: `m_${Date.now()}`, userId: myId, text, time: Date.now() };
    setMessages((prev) => [...prev, msg]);
    log.debug('send message', text);
  };

  const { listening, transcript, toggle } = useSpeechToText({
    locale: 'vi-VN',
    onResult: undefined,
  });

  const [compose, setCompose] = useState('');
  useEffect(() => {
    // bind transcript to input when listening
    if (transcript && transcript !== compose) {
      setCompose(transcript);
    }
    log.info("Listening.transcript", transcript);
  }, [transcript]);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: 'padding' })}
        keyboardVerticalOffset={Platform.select({ ios: 60, android: 30 })}
      >
        <View style={styles.frame}>
          <View style={styles.header}> 
            <Text style={styles.headerTitle}>Chat</Text>
          </View>
          <View style={styles.messagesArea}>
            <ChatMessageList messages={messages} userId={myId} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
    padding: 15,
  },
  frame: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: CONFIG.THEME.border,
    backgroundColor: CONFIG.COLORS.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    textAlign: 'center',
  },
  messagesArea: {
    flex: 1,
  },
});

export default ChatScreen;


