import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CONFIG from '../constants/config';

const ChatMessageBubble = ({ message, isOwn, showAvatar = false, showTime = true, isFirstInGroup = true, isLastInGroup = true }) => {
  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}> 
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, isFirstInGroup ? styles.bubbleFirst : null, isLastInGroup ? styles.bubbleLast : null] }>
        {!!message.text && (
          <Text style={[styles.text, isOwn ? styles.textOwn : styles.textOther]}>{message.text}</Text>
        )}
        {showTime && !!message.time && (
          <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
            {new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleOwn: {
    backgroundColor: CONFIG.THEME.primary,
  },
  bubbleOther: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EAF2',
  },
  bubbleFirst: {
    marginTop: 6,
  },
  bubbleLast: {
    marginBottom: 10,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  textOwn: {
    color: CONFIG.COLORS.white,
  },
  textOther: {
    color: CONFIG.COLORS.dark,
  },
  time: {
    fontSize: 11,
    marginTop: 6,
  },
  timeOwn: {
    color: 'rgba(255,255,255,0.8)',
    alignSelf: 'flex-end',
  },
  timeOther: {
    color: CONFIG.COLORS.gray,
    alignSelf: 'flex-start',
  },
  tail: {},
  tailOwn: {},
  tailOther: {},
});

export default ChatMessageBubble;


