import { useState, useEffect, useCallback, useRef } from 'react';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('useDeviceData');
import environment from '../config/environment';
import { io } from 'socket.io-client';

export const useDeviceData = () => {
  const [deviceData, setDeviceData] = useState(null);
  const [devicesList, setDevicesList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const socketRef = useRef(null);

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

  // Initial load and socket subscription for real-time updates
  useEffect(() => {
    fetchDevices();

    const gatewayUrl = environment.getApiUrl('GATEWAY');
    const socket = io(gatewayUrl, {
      path: '/ws/devices',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      log.info('socket connected via gateway');
    });

    socket.on('device.telemetry', ({ deviceId, payload }) => {
      try {
        if (!payload) return;
        // If no device selected yet, do not auto-select here; fetchDevices already handles first selection
        if (selectedDevice && deviceId !== selectedDevice) return;

        const latestTelemetry = {
          temp: payload.temp ?? null,
          humid: payload.humid ?? null,
          smoke: payload.smoke ?? null,
          gas_ppm: payload.gas_ppm ?? null,
          mq2_v: payload.mq2_v ?? null,
          flame: payload.flame ?? null,
          o: {
            o1: payload.o?.o1 ?? null,
            o2: payload.o?.o2 ?? null,
            o3: payload.o?.o3 ?? null,
            o4: payload.o?.o4 ?? null,
            o5: payload.o?.o5 ?? null,
          },
          ts: Date.now(),
        };

        setDeviceData((prev) => ({
          ...(prev || {}),
          deviceId: deviceId || prev?.deviceId,
          latestTelemetry,
          lastUpdate: new Date().toISOString(),
        }));
      } catch (e) {
        log.error('sensorData handler error', e?.message || e);
      }
    });

    socket.on('device.outlet', ({ deviceId: dId, outletId, status }) => {
      if (selectedDevice && dId !== selectedDevice) return;
      setDeviceData((prev) => {
        if (!prev) return prev;
        const o = { ...(prev.latestTelemetry?.o || {}) };
        if (outletId) o[outletId] = status;
        return {
          ...prev,
          latestTelemetry: { ...(prev.latestTelemetry || {}), o },
          lastUpdate: new Date().toISOString(),
        };
      });
    });

    socket.on('ack', () => {
      // Optional: could set lastUpdate timestamp to indicate activity
      setDeviceData((prev) => (prev ? { ...prev, lastUpdate: new Date().toISOString() } : prev));
    });

    socket.on('disconnect', () => {
      log.warn('socket disconnected');
    });

    return () => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [fetchDevices, selectedDevice]);

  // Remove device from list (when device ownership is removed)
  const removeDevice = useCallback((deviceId, newSelectedDevice = null) => {
    setDevicesList(prev => prev.filter(id => id !== deviceId));
    if (selectedDevice === deviceId) {
      if (newSelectedDevice) {
        // Auto-select the new device
        setSelectedDevice(newSelectedDevice);
        fetchDeviceStatus(newSelectedDevice);
      } else {
        // No devices left, clear selection
        setSelectedDevice(null);
        setDeviceData(null);
        setDeviceDetail(null);
      }
    }
  }, [selectedDevice, fetchDeviceStatus]);

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
    removeDevice,
  };
};
