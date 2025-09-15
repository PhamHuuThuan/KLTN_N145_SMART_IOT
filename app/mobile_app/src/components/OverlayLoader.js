import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DEFAULT_TIMEOUT_MS = 5000;

const OverlayLoader = ({
  visible,
  message = 'Processing... Please wait',
  onCancel,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cancellable = true,
}) => {
  const [canCancel, setCanCancel] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible && cancellable) {
      // Enable cancel after timeout
      timerRef.current = setTimeout(() => {
        setCanCancel(true);
      }, Math.max(1000, timeoutMs));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCanCancel(false);
    };
  }, [visible, cancellable, timeoutMs]);

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.message}>{message}</Text>
          {cancellable && (
            <TouchableOpacity
              style={[styles.cancelButton, !canCancel && { opacity: 0.5 }]}
              onPress={() => canCancel && onCancel && onCancel()}
              activeOpacity={0.8}
              disabled={!canCancel}
            >
              <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.cancelText}>{canCancel ? 'Cancel' : 'Please wait...'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: 'auto',
    maxWidth: 320,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  message: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(31,41,55,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  cancelText: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default OverlayLoader;


