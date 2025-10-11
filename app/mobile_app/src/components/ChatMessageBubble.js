import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../constants/config';
import { useTheme } from '../contexts/ThemeContext';

const ChatMessageBubble = ({ message, isOwn, showAvatar = false, showTime = true, isFirstInGroup = true, isLastInGroup = true, onOutletPress }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}> 
      <View style={[
        styles.bubble, 
        isOwn ? [styles.bubbleOwn, { backgroundColor: colors.primary }] : [styles.bubbleOther, { backgroundColor: colors.surface, borderColor: colors.border }], 
        isFirstInGroup ? styles.bubbleFirst : null, 
        isLastInGroup ? styles.bubbleLast : null
      ]}>
        {!!message.text && (
          <Text style={[styles.text, { color: isOwn ? colors.white : colors.text }]}>{message.text}</Text>
        )}
        
        {/* Outlet Card */}
        {message.outletCard && (
          <TouchableOpacity 
            style={[styles.outletCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onOutletPress && onOutletPress(message.outletCard)}
          >
            <View style={styles.outletHeader}>
              <View style={[styles.outletStatus, { backgroundColor: message.outletCard.status ? colors.success : colors.gray }]} />
              <Text style={[styles.outletName, { color: colors.text }]}>{message.outletCard.name}</Text>
              <Ionicons 
                name="chevron-forward" 
                size={16} 
                color={colors.textSecondary} 
              />
            </View>
            <Text style={[styles.outletId, { color: colors.textSecondary }]}>
              ID: {message.outletCard.id}
            </Text>
          </TouchableOpacity>
        )}
        
        {showTime && !!message.time && (
          <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
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
    // backgroundColor handled by theme
  },
  bubbleOther: {
    borderWidth: 1,
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
    // color handled by theme
  },
  textOther: {
    // color handled by theme
  },
  time: {
    fontSize: 11,
    marginTop: 6,
  },
  outletCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  outletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  outletStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  outletName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  outletId: {
    fontSize: 12,
    marginTop: 2,
  },
  timeOwn: {
    alignSelf: 'flex-end',
  },
  timeOther: {
    alignSelf: 'flex-start',
  },
  tail: {},
  tailOwn: {},
  tailOther: {},
});

export default ChatMessageBubble;


