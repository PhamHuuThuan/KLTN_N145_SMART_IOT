import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('useDeviceData');
import CONFIG from '../constants/config';

export const useDeviceData = () => {
  const [deviceData, setDeviceData] = useState(null);
  const [devicesList, setDevicesList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceDetail, setDeviceDetail] = useState(null);

  // Fetch device status
  const fetchDeviceStatus = useCallback(async (deviceId) => {
    if (!deviceId) return;
    
    try {
      log.debug('fetch status', deviceId);
      const response = await apiService.getDeviceStatus(deviceId);
      log.debug('status received');
      // apiService returns already-unwrapped data; ensure safe defaults
      const data = response?.data || response || {};
      setDeviceData({
        deviceId,
        latestTelemetry: null,
        outlets: [],
        ...data,
      });
    } catch (err) {
      log.error('fetchDeviceStatus error', err?.message || err);
      setError(err.message);
    }
  }, []);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getDevices();
      const devices = response.data || [];
      
      log.info('devices loaded', devices.length);
      
      // Map devices to get deviceId, guard against bad entries
      const deviceIds = devices.map(device => device?.deviceId).filter(Boolean);
      setDevicesList(deviceIds);
      
      // Only auto-select first device if nothing selected yet
      if (!selectedDevice && deviceIds.length > 0) {
        const firstDevice = deviceIds[0];
        log.info('auto-selected device', firstDevice);
        setSelectedDevice(firstDevice);
        await fetchDeviceStatus(firstDevice);
      }
    } catch (err) {
      log.error('fetchDevices error', err?.message || err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, fetchDeviceStatus]);

  // Fetch full device detail for UI (e.g., modal)
  const fetchDeviceDetail = useCallback(async (deviceId) => {
    if (!deviceId) return;
    try {
      const response = await apiService.getDeviceDetail(deviceId);
      setDeviceDetail(response.data || response);
    } catch (err) {
      log.error('fetchDeviceDetail error', err?.message || err);
    }
  }, []);

  // Select device
  const selectDevice = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId);
    await fetchDeviceStatus(deviceId);
  }, [fetchDeviceStatus]);

  // Auto refresh effect
  useEffect(() => {
    fetchDevices();
    
    const interval = setInterval(() => {
      if (selectedDevice) {
        fetchDeviceStatus(selectedDevice);
      }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
    
    return () => clearInterval(interval);
  }, [fetchDevices, selectedDevice, fetchDeviceStatus]);

  return {
    deviceData,
    deviceDetail,
    devicesList,
    selectedDevice,
    loading,
    error,
    fetchDevices,
    selectDevice,
    fetchDeviceStatus,
    fetchDeviceDetail,
    refreshDevices: fetchDevices,
  };
};
