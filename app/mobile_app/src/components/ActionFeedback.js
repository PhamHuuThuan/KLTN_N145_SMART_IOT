import React, { useEffect, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  success: '#16A34A',
  error: '#DC2626',
};

const ICONS = {
  success: 'checkmark-circle-outline',
  error: 'close-circle-outline',
};

const ActionFeedback = ({ type = 'success', message = 'Done', visible, onHide, duration = 1800 }) => {
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    let timer;
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          onHide && onHide();
        });
      }, duration);
    }
    return () => timer && clearTimeout(timer);
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}> 
      <View style={[styles.card, { borderLeftColor: COLORS[type] }]}> 
        <Ionicons name={ICONS[type]} size={22} color={COLORS[type]} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    color: '#1F2937',
    fontWeight: '600',
  }
});

export default ActionFeedback;


