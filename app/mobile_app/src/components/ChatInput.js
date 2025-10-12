import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';

const ChatInput = ({ onSend, onVoiceToggle, listening = false, value, onChangeText, disabled = false, placeholder = 'Type a message' }) => {
  const { colors } = useTheme();
  const [innerText, setInnerText] = useState('');
  const text = value !== undefined ? value : innerText;
  const setText = onChangeText || setInnerText;

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    onSend?.(value);
    setText('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          editable={!disabled}
          multiline
        />
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.voiceButton, listening ? styles.voiceOn : styles.voiceOff]}
            onPress={() => {
              onVoiceToggle?.(!listening);
            }}
          >
            <Ionicons
              name={listening ? 'mic' : 'mic-outline'}
              size={20}
              color={listening ? colors.primary : colors.gray}
            />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.sendIconWrap} onPress={handleSend} disabled={disabled || !text.trim()}>
        <Ionicons name="send" size={22} color={(disabled || !text.trim()) ? colors.gray : colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 16,
  },
  sendIconWrap: {
    padding: 8,
    borderRadius: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  voiceButton: {
    alignSelf: 'center',
    padding: 6,
    borderRadius: 14,
  },
  voiceOn: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  voiceOff: {
    backgroundColor: 'transparent',
  },
});

export default ChatInput;


