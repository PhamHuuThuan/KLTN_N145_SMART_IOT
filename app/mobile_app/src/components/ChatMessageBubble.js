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
            style={[
              styles.outletCard, 
              { 
                backgroundColor: message.outletCard.status ? '#4CAF50' : '#FFFFFF',
                borderColor: message.outletCard.status ? '#4CAF50' : '#E0E0E0',
                borderWidth: 1
              }
            ]}
            onPress={() => onOutletPress && onOutletPress(message.outletCard)}
          >
            {/* Header with icon and name */}
            <View style={styles.outletHeader}>
              <Ionicons 
                name="home-outline" 
                size={20} 
                color={message.outletCard.status ? '#FFFFFF' : '#666666'} 
              />
              <Text style={[
                styles.outletName, 
                { color: message.outletCard.status ? '#FFFFFF' : '#333333' }
              ]}>
                {message.outletCard.name}
              </Text>
              <Ionicons 
                name="chevron-forward" 
                size={16} 
                color={message.outletCard.status ? '#FFFFFF' : '#666666'} 
                style={styles.outletChevron}
              />
            </View>
            
            {/* Status icon and text */}
            <View style={styles.outletStatusSection}>
              <Ionicons 
                name={message.outletCard.status ? "power" : "ellipse-outline"} 
                size={24} 
                color={message.outletCard.status ? '#FFFFFF' : '#666666'} 
              />
              <Text style={[
                styles.outletStatusText,
                { color: message.outletCard.status ? '#FFFFFF' : '#333333' }
              ]}>
                {message.outletCard.status ? 'BẬT' : 'TẮT'}
              </Text>
            </View>
            
            {/* Navigation hint */}
            <View style={styles.outletHintSection}>
              <Text style={[
                styles.outletHintText,
                { color: message.outletCard.status ? '#FFFFFF' : '#666666' }
              ]}>
                Nhấn để xem chi tiết
              </Text>
            </View>
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
    padding: 16,
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  outletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  outletName: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  outletChevron: {
    marginLeft: 'auto',
  },
  outletStatusSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  outletStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  outletHintSection: {
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  outletHintText: {
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.7,
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


