import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import CONFIG from '../constants/config';

export const useDeviceData = () => {
  const [deviceData, setDeviceData] = useState(null);
  const [devicesList, setDevicesList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getDevices();
      const devices = response.data || [];
      
      console.log('📱 Devices received:', devices);
      
      // Map devices to get deviceId
      const deviceIds = devices.map(device => device.deviceId);
      setDevicesList(deviceIds);
      
      if (deviceIds.length > 0) {
        const firstDevice = deviceIds[0];
        console.log('📱 Selected device:', firstDevice);
        setSelectedDevice(firstDevice);
        await fetchDeviceStatus(firstDevice);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch device status
  const fetchDeviceStatus = useCallback(async (deviceId) => {
    if (!deviceId) return;
    
    try {
      console.log('📱 Fetching status for device:', deviceId);
      const response = await apiService.getDeviceStatus(deviceId);
      console.log('📱 Device status received:', response);
      setDeviceData(response.data);
    } catch (err) {
      console.error('Error fetching device status:', err);
      setError(err.message);
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
    devicesList,
    selectedDevice,
    loading,
    error,
    fetchDevices,
    selectDevice,
  };
};
