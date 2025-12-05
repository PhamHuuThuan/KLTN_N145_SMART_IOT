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

const ActionFeedback = ({ type = 'success', message = 'Done', visible, onHide, duration = 3000 }) => {
  const [opacity] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-50));

  useEffect(() => {
    let timer;
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
      
      timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -50, duration: 300, useNativeDriver: true })
        ]).start(() => {
          onHide && onHide();
        });
      }, duration);
    } else {
      opacity.setValue(0);
      translateY.setValue(-50);
    }
    return () => timer && clearTimeout(timer);
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { 
        opacity,
        transform: [{ translateY }]
      }
    ]}> 
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
    top: 60, // Show at top of screen instead of bottom
    alignItems: 'center',
    zIndex: 1000, // Ensure it's above other content
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
