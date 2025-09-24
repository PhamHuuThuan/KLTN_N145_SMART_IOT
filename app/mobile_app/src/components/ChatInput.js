import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../constants/config';

const ChatInput = ({ onSend, disabled = false, placeholder = 'Type a message' }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    onSend?.(value);
    setText('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={CONFIG.COLORS.gray}
          editable={!disabled}
          multiline
        />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconButton} disabled>
            <Ionicons name="image" size={20} color={CONFIG.COLORS.gray} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} disabled>
            <Ionicons name="mic" size={20} color={CONFIG.COLORS.gray} />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.sendIconWrap} onPress={handleSend} disabled={disabled || !text.trim()}>
        <Ionicons name="send" size={22} color={(disabled || !text.trim()) ? CONFIG.THEME.gray : CONFIG.THEME.primary} />
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
    backgroundColor: CONFIG.COLORS.white,
    borderTopWidth: 1,
    borderTopColor: CONFIG.THEME.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: CONFIG.COLORS.white,
    borderRadius: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: CONFIG.THEME.border,
    borderRadius: 16,
    backgroundColor: CONFIG.COLORS.white,
  },
  sendIconWrap: {
    padding: 8,
    borderRadius: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  iconButton: {
    padding: 6,
    borderRadius: 12,
  },
});

export default ChatInput;


