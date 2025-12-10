import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import CONFIG from '../constants/config';
import OverlayLoader from './OverlayLoader';
import ActionFeedback from './ActionFeedback';

const OutletControl = ({ 
  selectedDevice, 
  deviceData, 
  onControlOutlet, 
  loading 
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [buttonScale] = useState(new Animated.Value(1));
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  // Pulse animation for button
  useEffect(() => {
    if (loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loading, pulseAnim]);

  const handleToggle = async () => {
    if (!selectedDevice) {
      setFeedback({ visible: true, type: 'error', message: 'Please select a device first' });
      return;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setShowLoader(true);
    const success = await onControlOutlet('toggle', selectedDevice);
    setShowLoader(false);
    if (success) {
      setFeedback({ visible: true, type: 'success', message: `Outlet toggled` });
    } else {
      setFeedback({ visible: true, type: 'error', message: 'Failed to send command' });
    }
  };

  if (!selectedDevice) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔌 Outlet Control (LED)</Text>
      <Text style={styles.deviceInfo}>Device: {selectedDevice}</Text>
      <Text style={styles.outletStatus}>
        Status: {deviceData?.outlets?.o1 ? 'ON' : 'OFF'}
      </Text>
      
      <View style={styles.controlButtons}>
        <Animated.View
          style={[
            styles.animatedButton,
            {
              transform: [
                { scale: buttonScale },
                { scale: pulseAnim }
              ]
            }
          ]}
        >
          <TouchableOpacity
            style={[
              styles.controlButton, 
              styles.toggleButton,
              loading && styles.loadingButton
            ]}
            onPress={handleToggle}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, loading && styles.loadingText]}>
              {loading ? '⏳ Toggling...' : '💡 Toggle LED'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      <OverlayLoader
        visible={showLoader}
        message="Sending command..."
        onCancel={() => setShowLoader(false)}
      />
      <ActionFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onHide={() => setFeedback({ ...feedback, visible: false })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: CONFIG.COLORS.white,
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginBottom: 15,
  },
  deviceInfo: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    marginBottom: 5,
  },
  outletStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginBottom: 15,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  animatedButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlButton: {
    paddingVertical: 15,
    paddingHorizontal: 35,
    borderRadius: 25,
    alignItems: 'center',
    minWidth: 180,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  toggleButton: {
    backgroundColor: CONFIG.COLORS.warning,
  },
  loadingButton: {
    backgroundColor: CONFIG.COLORS.gray,
    borderColor: CONFIG.COLORS.primary,
  },
  buttonText: {
    color: CONFIG.COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  loadingText: {
    color: CONFIG.COLORS.light,
  },
});

export default OutletControl;
