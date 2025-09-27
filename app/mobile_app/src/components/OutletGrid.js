import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import OverlayLoader from './OverlayLoader';
import ActionFeedback from './ActionFeedback';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import OutletDetail from './OutletDetail';
import CONFIG from '../constants/config';
import { createLogger } from '../utils/logger';

const log = createLogger('OutletGrid');

const OutletGrid = ({ 
  selectedDevice, 
  deviceData, 
  onControlOutlet, 
  onUpdateOutletSettings,
  loading,
  onRefreshDeviceData
}) => {
  const [buttonScales] = useState(() => 
    Array.from({ length: 5 }, () => new Animated.Value(1))
  );
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });

  // Get outlets from device data; if missing, show empty state
  const getOutlets = () => {
    if (deviceData?.outlets && Array.isArray(deviceData.outlets)) {
      return deviceData.outlets.map(outlet => ({
        id: outlet.id,
        name: outlet.name || `Outlet ${outlet.id}`,
        icon: outlet.type === 'safety' ? 'shield' : 'stove',
        type: outlet.type || 'kitchen'
      }));
    }
    return [];
  };

  const outlets = getOutlets();

  const handleOutletClick = (outlet) => {
    setSelectedOutlet(outlet);
    setDetailVisible(true);
  };

  const handleOutletControl = async (action, deviceId, outletId) => {
    log.debug('handleOutletControl', action, deviceId, outletId);
    log.debug('props', { hasOnControlOutlet: typeof onControlOutlet, selectedDevice });
    
    const targetDeviceId = deviceId || selectedDevice;
    if (!targetDeviceId) {
      log.error('No device ID provided');
      return false;
    }

    const outletIndex = outlets.findIndex(outlet => outlet.id === outletId);
    if (outletIndex === -1) {
      log.error('Outlet not found', outletId);
      return false;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScales[outletIndex], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScales[outletIndex], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    log.debug('Calling onControlOutlet', action, targetDeviceId, outletId);
    setShowLoader(true);
    const success = await onControlOutlet(action, targetDeviceId, outletId);
    setShowLoader(false);
    log.debug('result', success);
    if (success) {
      setFeedback({ visible: true, type: 'success', message: `Outlet ${action}` });
    } else {
      setFeedback({ visible: true, type: 'error', message: 'Failed to send command' });
    }
    return success;
  };

  const handleQuickToggle = async (outletId) => {
    const currentStatus = getOutletStatus(outletId);
    const action = currentStatus ? 'off' : 'on';
    const success = await handleOutletControl(action, selectedDevice, outletId);
    
    if (success) {
      log.info('Quick toggle', action, outletId);
      // Refresh device data after successful toggle
      if (onRefreshDeviceData) {
        setTimeout(() => {
          onRefreshDeviceData();
        }, 500);
      }
    } else {
      log.error('Failed to toggle outlet', outletId);
    }
  };

  const handleUpdateOutletSettings = async (outletId, settings) => {
    if (onUpdateOutletSettings) {
      await onUpdateOutletSettings(outletId, settings);
      // Update local selectedOutlet to reflect latest changes in the detail modal
      setSelectedOutlet(prev => (prev && prev.id === outletId) ? { ...prev, name: settings.name ?? prev.name, type: settings.type ?? prev.type } : prev);
      // Optionally refresh device data so grid reflects server state
      if (onRefreshDeviceData) {
        setTimeout(() => onRefreshDeviceData(), 200);
      }
    }
  };

  const getOutletStatus = (outletId) => {
    // First try to get from latestTelemetry.o (real-time data)
    if (deviceData?.latestTelemetry?.o && deviceData.latestTelemetry.o[outletId] !== undefined) {
      return deviceData.latestTelemetry.o[outletId];
    }
    
    // Fallback to outlets array
    const outlets = deviceData?.outlets;
    if (!outlets) return false;
  
    if (Array.isArray(outlets)) {
      const outlet = outlets.find(o => o.id === outletId || o._id === outletId);
      return outlet?.status ?? false;
    }
  
    return outlets[outletId]?.status ?? false;
  };

  const getOutletColor = (outletId) => {
    const isOn = getOutletStatus(outletId);
    return isOn ? CONFIG.COLORS.success : CONFIG.COLORS.gray;
  };

  const getOutletIcon = (outletId) => {
    const isOn = getOutletStatus(outletId);
    return isOn ? 'power' : 'power-off';
  };

  if (!selectedDevice) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDeviceText}>Please select a device first</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔌 Outlet Control</Text>
      <Text style={styles.deviceInfo}>Device: {selectedDevice || 'Not selected'}</Text>
      
      <View style={styles.grid}>
        {outlets.length === 0 && (
          <Text style={styles.noDeviceText}>No outlets configured or data not found</Text>
        )}
        {outlets.map((outlet, index) => {
          const isOn = getOutletStatus(outlet.id);
          const isDisabled = loading || !deviceData?.latestTelemetry;
          
          return (
            <Animated.View
              key={outlet.id}
              style={[
                styles.outletCard,
                {
                  transform: [{ scale: buttonScales[index] }],
                  backgroundColor: isOn ? CONFIG.COLORS.success : CONFIG.COLORS.light,
                  borderColor: isOn ? CONFIG.THEME.success : CONFIG.THEME.border,
                }
              ]}
            >
            <TouchableOpacity
              style={styles.outletButton}
              onPress={() => handleOutletClick(outlet)}
              disabled={isDisabled}
              activeOpacity={0.8}
            >
                <View style={styles.outletHeader}>
                  <MaterialCommunityIcons 
                    name={outlet.icon} 
                    size={20} 
                    color={isOn ? CONFIG.COLORS.white : CONFIG.COLORS.gray} 
                  />
                  <Text style={[
                    styles.outletName,
                    { color: isOn ? CONFIG.COLORS.white : CONFIG.COLORS.gray }
                  ]}>
                    {outlet.name}
                  </Text>
                </View>
                
                <View style={styles.outletStatus}>
                  <MaterialCommunityIcons 
                    name={getOutletIcon(outlet.id)} 
                    size={24} 
                    color={isOn ? CONFIG.COLORS.white : CONFIG.COLORS.gray} 
                  />
                  <Text style={[
                    styles.statusText,
                    { color: isOn ? CONFIG.COLORS.white : CONFIG.COLORS.gray }
                  ]}>
                    {isOn ? 'ON' : 'OFF'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              {/* Toggle Button */}
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: isOn ? CONFIG.COLORS.danger : CONFIG.COLORS.success }
                ]}
                onPress={() => handleQuickToggle(outlet.id)}
                disabled={isDisabled}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons 
                  name={isOn ? 'power-off' : 'power'} 
                  size={18} 
                  color={CONFIG.COLORS.white} 
                />
                <Text style={styles.toggleText}>
                  {isOn ? 'TURN OFF' : 'TURN ON'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      
      {loading && (
        <Text style={styles.loadingText}>⏳ Processing...</Text>
      )}

      <OutletDetail
        outlet={selectedOutlet}
        deviceId={selectedDevice}
        isVisible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onUpdateOutlet={handleUpdateOutletSettings}
        onControlOutlet={handleOutletControl}
        loading={loading}
        deviceData={deviceData}
        onRefreshDeviceData={onRefreshDeviceData}
      />
      <OverlayLoader
        visible={showLoader}
        message="Working..."
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
  container: {
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CONFIG.COLORS.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  deviceInfo: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    marginBottom: 15,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  outletCard: {
    width: '48%',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    minHeight: 140,
  },
  outletButton: {
    padding: 12,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
    paddingBottom: 60, // Make space for toggle button
  },
  outletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  outletName: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    textAlign: 'center',
  },
  outletStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  noDeviceText: {
    fontSize: 14,
    color: CONFIG.COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  toggleButton: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  toggleText: {
    color: CONFIG.COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});

export default OutletGrid;
