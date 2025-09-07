import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import OutletDetail from './OutletDetail';
import CONFIG from '../constants/config';

const OutletGrid = ({ 
  selectedDevice, 
  deviceData, 
  onControlOutlet, 
  onUpdateOutletSettings,
  loading 
}) => {
  const [buttonScales] = useState(() => 
    Array.from({ length: 5 }, () => new Animated.Value(1))
  );
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Get outlets from device data or use defaults
  const getOutlets = () => {
    if (deviceData?.outlets && Array.isArray(deviceData.outlets)) {
      return deviceData.outlets.map(outlet => ({
        id: outlet.id,
        name: outlet.name || `Outlet ${outlet.id}`,
        icon: outlet.type === 'safety' ? 'security' : 'kitchen',
        type: outlet.type || 'kitchen'
      }));
    }
    
    // Default outlets configuration
    return [
      { id: 'o1', name: 'Outlet 1', icon: 'kitchen', type: 'kitchen' },
      { id: 'o2', name: 'Outlet 2', icon: 'kitchen', type: 'kitchen' },
      { id: 'o3', name: 'Outlet 3', icon: 'kitchen', type: 'kitchen' },
      { id: 'o4', name: 'Outlet 4', icon: 'security', type: 'safety' },
      { id: 'o5', name: 'Outlet 5', icon: 'security', type: 'safety' }
    ];
  };

  const outlets = getOutlets();

  const handleOutletClick = (outlet) => {
    setSelectedOutlet(outlet);
    setDetailVisible(true);
  };

  const handleOutletControl = async (action, outletId) => {
    if (!selectedDevice) {
      return;
    }

    const outletIndex = outlets.findIndex(outlet => outlet.id === outletId);
    if (outletIndex === -1) return;

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

    const success = await onControlOutlet(action, selectedDevice, outletId);
    return success;
  };

  const handleUpdateOutletSettings = async (outletId, settings) => {
    if (onUpdateOutletSettings) {
      await onUpdateOutletSettings(outletId, settings);
    }
  };

  const getOutletStatus = (outletId) => {
    if (!deviceData?.outlets) return false;
    return deviceData.outlets[outletId] || false;
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
      <Text style={styles.deviceInfo}>Device: {selectedDevice}</Text>
      
      <View style={styles.grid}>
        {outlets.map((outlet, index) => {
          const isOn = getOutletStatus(outlet.id);
          const isDisabled = loading;
          
          return (
            <Animated.View
              key={outlet.id}
              style={[
                styles.outletCard,
                {
                  transform: [{ scale: buttonScales[index] }],
                  backgroundColor: isOn ? CONFIG.COLORS.success : CONFIG.COLORS.light,
                  borderColor: isOn ? CONFIG.COLORS.success : CONFIG.COLORS.gray,
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
                  <MaterialIcons 
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
                  <MaterialIcons 
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
  },
  outletButton: {
    padding: 12,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
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
});

export default OutletGrid;
