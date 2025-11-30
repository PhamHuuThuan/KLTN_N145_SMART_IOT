import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useDeviceData } from '../hooks/useDeviceData';
import { useOutletControl } from '../hooks/useOutletControl';
import Header from '../components/Header';
import DeviceSelector from '../components/DeviceSelector';
import SensorGrid from '../components/SensorGrid';
import OutletGrid from '../components/OutletGrid';
import DeviceInfoModal from '../components/DeviceInfoModal';
import ActionFeedback from '../components/ActionFeedback';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('Home');
import CONFIG from '../constants/config';

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const {
    deviceData,
    deviceDetail,
    devicesList,
    selectedDevice,
    loading,
    error,
    hasMore,
    loadingMore,
    fetchDevices,
    loadMoreDevices,
    selectDevice,
    fetchDeviceStatus,
    fetchDeviceDetail,
  } = useDeviceData();

  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: 'success', message: '' });
  const [exitingEmergency, setExitingEmergency] = useState(false);
  const borderOpacity = useRef(new Animated.Value(0)).current;
  const borderAnimation = useRef(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayAnimation = useRef(null);

  const { controlOutlet, loading: controlLoading } = useOutletControl();

  useEffect(() => {
    if (deviceData?.emergencyMode) {
      // Start blinking border animation
      borderAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(borderOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(borderOpacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      );
      borderAnimation.current.start();

      overlayAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(overlayOpacity, {
            toValue: 0.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(overlayOpacity, {
            toValue: 0.03,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      overlayAnimation.current.start();
    } else {
      // Stop animations and reset
      if (borderAnimation.current) {
        borderAnimation.current.stop();
      }
      if (overlayAnimation.current) {
        overlayAnimation.current.stop();
      }
      borderOpacity.setValue(0);
      overlayOpacity.setValue(0);
    }

    return () => {
      if (borderAnimation.current) {
        borderAnimation.current.stop();
      }
      if (overlayAnimation.current) {
        overlayAnimation.current.stop();
      }
    };
  }, [deviceData?.emergencyMode, borderOpacity, overlayOpacity]);

  const onRefresh = async () => {
    await fetchDevices(1, 20);
  };

  const handleExitEmergencyMode = async () => {
    if (!selectedDevice) return;
    
    try {
      setExitingEmergency(true);
      await apiService.exitEmergencyMode(selectedDevice);
      setFeedback({ 
        visible: true, 
        type: 'success', 
        message: t('emergency.emergencyDeactivated', 'Emergency Mode Deactivated') 
      });
      await fetchDeviceStatus(selectedDevice);
      await fetchDeviceDetail(selectedDevice);
    } catch (error) {
      log.error('Error exiting emergency mode', error?.message || error);
      setFeedback({ 
        visible: true, 
        type: 'error', 
        message: error.message || t('emergency.exitEmergencyModeFailed', 'Failed to exit emergency mode') 
      });
    } finally {
      setExitingEmergency(false);
    }
  };

  const animatedBorderColor = borderOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.danger || '#EF4444'],
  });

  return (
    <Animated.View 
      style={[
        styles.outerContainer,
        deviceData?.emergencyMode && {
          borderWidth: 4,
          borderColor: animatedBorderColor,
        }
      ]}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <Header onNotificationPress={() => navigation?.navigate('Notifications')} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <DeviceSelector
          devices={devicesList}
          selectedDevice={selectedDevice}
          onSelectDevice={async (deviceId) => {
            await selectDevice(deviceId);
            await fetchDeviceDetail(deviceId);
          }}
          onPressDetails={() => setShowDeviceInfo(true)}
          onDeviceAdded={async () => {
            // Refresh devices list when a new device is added
            await fetchDevices(1, 20);
          }}
          onDeviceRemoved={async (deviceId, newSelectedDevice = null) => {
            // Refresh devices list when a device is removed
            if (selectedDevice === deviceId && !newSelectedDevice) {
              await selectDevice(null);
            }

            await fetchDevices(1, 20);

            if (newSelectedDevice) {
              await selectDevice(newSelectedDevice);
              await fetchDeviceDetail(newSelectedDevice);
            }
          }}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMoreDevices}
        />

        {deviceData?.deviceId && (
          <View style={[
            styles.statusCard,
            { backgroundColor: colors.surfaceSecondary }
          ]}>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <View style={[
                  styles.statusIndicatorDot,
                  { backgroundColor: deviceData?.isOnline ? colors.success : colors.danger }
                ]} />
                <Text style={[styles.statusLabel, { color: colors.text }]}>
                  {deviceData?.isOnline ? t('devices.online', 'Online') : t('devices.offline', 'Offline')}
                </Text>
              </View>
              {deviceData?.lastSeenAt || deviceData?.lastUpdate ? (
                <Text style={[styles.statusTime, { color: colors.textSecondary }]}>
                  {new Date(deviceData.lastSeenAt || deviceData.lastUpdate).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {deviceData?.emergencyMode && (
          <View style={[
            styles.emergencyCard,
            { backgroundColor: colors.danger + '20', borderColor: colors.danger }
          ]}>
            <View style={styles.emergencyHeader}>
              <Text style={[styles.emergencyTitle, { color: colors.danger }]}>
                {t('emergency.title', 'Emergency Mode')}
              </Text>
              <TouchableOpacity
                style={[styles.exitButton, { backgroundColor: colors.danger }]}
                onPress={handleExitEmergencyMode}
                disabled={exitingEmergency}
              >
                {exitingEmergency ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.exitButtonText}>
                    {t('emergency.exitEmergencyMode', 'Exit Emergency Mode')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <SensorGrid 
          deviceData={deviceData} 
          onViewChart={(deviceId) => {
            navigation?.navigate?.('SensorChart', { deviceId: deviceId || selectedDevice });
          }}
        />

        <OutletGrid
          selectedDevice={selectedDevice}
          deviceData={deviceData}
          onControlOutlet={controlOutlet}
          onUpdateOutletSettings={async (outletId, settings) => {
            try {
              const response = await apiService.updateOutletSettings(selectedDevice, outletId, settings);
              log.info('Outlet settings updated');
              // Refresh device data
              await fetchDeviceStatus(selectedDevice);
            } catch (error) {
              log.error('Error updating outlet settings', error?.message || error);
              setFeedback({ visible: true, type: 'error', message: error.message || t('devices.updateOutletSettingsFailed') });
            }
          }}
          loading={controlLoading}
          onRefreshDeviceData={() => fetchDeviceStatus(selectedDevice)}
        />

        <DeviceInfoModal
          visible={showDeviceInfo}
          onClose={() => setShowDeviceInfo(false)}
          deviceData={
            deviceDetail && deviceData
              ? { ...deviceDetail, ...deviceData }
              : (deviceData || deviceDetail)
          }
        />

        {error && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{t('common.error')}: {error}</Text>
          </View>
        )}
      </ScrollView>
      
      <ActionFeedback
        visible={feedback.visible}
        type={feedback.type}
        message={feedback.message}
        onHide={() => setFeedback({ ...feedback, visible: false })}
      />

      {deviceData?.emergencyMode && (
        <Animated.View
          style={[
            styles.emergencyOverlay,
            {
              opacity: overlayOpacity,
              backgroundColor: colors.danger || '#EF4444',
            }
          ]}
          pointerEvents="none"
        />
      )}
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCard: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTime: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emergencyCard: {
    borderRadius: CONFIG.DIMENSIONS.borderRadius,
    padding: CONFIG.DIMENSIONS.cardPadding,
    marginBottom: 15,
    borderWidth: 2,
    gap: 12,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  exitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emergencyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emergencyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
});

export default HomeScreen;
