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
  const devicesListRef = useRef([]);
  const selectedDeviceRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  const computeOnlineState = (device) => {
    if (!device) {
      return { status: 'offline', isOnline: false };
    }

    const statusValue = typeof device.status === 'string' ? device.status.toLowerCase() : null;
    const isOnline = typeof device.isOnline === 'boolean'
      ? device.isOnline
      : statusValue === 'online';

    return {
      status: isOnline ? 'online' : 'offline',
      isOnline,
    };
  };

  const normalizeDeviceSummary = (device) => {
    if (!device) return null;
    const { status, isOnline } = computeOnlineState(device);
    return {
      deviceId: device.deviceId,
      name: device.name,
      lastSeenAt: device.lastSeenAt || null,
      status,
      isOnline,
    };
  };

  const toIso = (value) => {
    if (value === undefined || value === null) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  };

  useEffect(() => {
    devicesListRef.current = devicesList;
  }, [devicesList]);

  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);
  const fetchDeviceStatus = useCallback(async (deviceId) => {
    if (!deviceId) {
      setDeviceData(null);
      return;
    }

    try {
      const response = await apiService.getDeviceStatus(deviceId);

      const payload = response?.data || response || {};
      const device = payload?.data || payload;

      if (!device || typeof device !== 'object') {
        throw new Error('Invalid device response');
      }

      const onlineState = computeOnlineState(device);
      const normalized = {
        ...device,
        ...onlineState,
        deviceId: device.deviceId || deviceId,
      };

      setDeviceData((prev) => ({
        ...(prev || {}),
        ...normalized,
        latestTelemetry: device.latestTelemetry ?? prev?.latestTelemetry ?? null,
        outlets: device.outlets ?? prev?.outlets ?? [],
      }));

      setDevicesList((prev) => {
        if (!Array.isArray(prev) || !prev.length) return prev;
        return prev.map((item) => (
          item.deviceId === normalized.deviceId
            ? {
                ...item,
                status: normalized.status,
                isOnline: normalized.isOnline,
                lastSeenAt: normalized.lastSeenAt || device.lastSeenAt || null,
              }
            : item
        ));
      });
    } catch (err) {
      log.error('fetchDeviceStatus error', err?.message || err);
      setError(err.message);
    }
  }, []);

  // Fetch devices
  const fetchDevices = useCallback(async (page = 1, limit = 20) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getDevices(page, limit);

      const devices = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {};
      const normalizedDevices = devices
        .map(normalizeDeviceSummary)
        .filter(Boolean);


      if (page === 1) {
        setDevicesList(normalizedDevices);
      } else {
        setDevicesList((prev) => {
          const existing = Array.isArray(prev) ? [...prev] : [];
          normalizedDevices.forEach((device) => {
            if (!device?.deviceId) return;
            const idx = existing.findIndex((item) => item.deviceId === device.deviceId);
            if (idx >= 0) {
              existing[idx] = { ...existing[idx], ...device };
            } else {
              existing.push(device);
            }
          });
          return existing;
        });
      }

      setCurrentPage(pagination.page || page);
      setTotalPages(pagination.pages || 1);
      setHasMore((pagination.page || page) < (pagination.pages || 1));

      if (page === 1 && normalizedDevices.length > 0) {
        const firstDevice = normalizedDevices[0]?.deviceId;
        if (firstDevice && (!selectedDevice || !normalizedDevices.some((d) => d.deviceId === selectedDevice))) {
          setSelectedDevice(firstDevice);
          await fetchDeviceStatus(firstDevice);
        }
      }
    } catch (err) {
      log.error('fetchDevices error', err?.message || err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, fetchDeviceStatus]);

  const fetchDeviceDetail = useCallback(async (deviceId) => {
    if (!deviceId) return;
    try {
      const response = await apiService.getDeviceDetail(deviceId);
      setDeviceDetail(response.data || response);
    } catch (err) {
      log.error('fetchDeviceDetail error', err?.message || err);
    }
  }, []);

  const loadMoreDevices = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }

    const nextPage = currentPage + 1;

    try {
      setLoadingMore(true);
      await fetchDevices(nextPage, 20);
    } catch (error) {
      log.error('Load more devices error:', error.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, currentPage, fetchDevices]);

  const selectDevice = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId);
    if (!deviceId) {
      setDeviceData(null);
      setDeviceDetail(null);
      return;
    }

    await fetchDeviceStatus(deviceId);
  }, [fetchDeviceStatus]);

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

    socket.on('connect', () => {});

    socket.on('device.telemetry', ({ deviceId, payload }) => {
      try {
        if (!payload) return;

        const currentList = devicesListRef.current;
        const currentSelected = selectedDeviceRef.current;
        const deviceExists = currentList.some(d => d.deviceId === deviceId);
        
        if (!deviceExists) {
          return;
        }

        const nowIso = new Date().toISOString();
        const payloadTsIso = toIso(payload.ts) || nowIso;

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
          ts: payload.ts ?? Date.now(),
        };

        setDevicesList((prev) => {
          if (!Array.isArray(prev) || !prev.length) return prev;
          return prev.map((item) => (item.deviceId === (deviceId || item.deviceId)
            ? {
                ...item,
                status: 'online',
                isOnline: true,
                lastSeenAt: payloadTsIso,
              }
            : item));
        });

        if (currentSelected === deviceId) {
          setDeviceData((prev) => ({
            ...(prev || {}),
            deviceId: deviceId || prev?.deviceId,
            latestTelemetry,
            lastUpdate: nowIso,
            lastSeenAt: payloadTsIso,
            status: 'online',
            isOnline: true,
            ...(payload.emergencyMode !== undefined && { emergencyMode: payload.emergencyMode }),
            ...(payload.lastEmergencyAt && { lastEmergencyAt: toIso(payload.lastEmergencyAt) || prev?.lastEmergencyAt }),
          }));
        }
      } catch (e) {
        log.error('sensorData handler error', e?.message || e);
      }
    });

    socket.on('device.outlet', ({ deviceId: dId, outletId, status }) => {
      const currentList = devicesListRef.current;
      const isExist = currentList.some(d => d.deviceId === dId);
      
      if (!isExist) {
        return;
      }

      const nowIso = new Date().toISOString();
      setDevicesList((prev) => {
        if (!Array.isArray(prev) || !prev.length) return prev;
        return prev.map((item) => (item.deviceId === (dId || item.deviceId)
          ? {
              ...item,
              status: 'online',
              isOnline: true,
              lastSeenAt: nowIso,
            }
          : item));
      });

      const currentSelected = selectedDeviceRef.current;
      if (currentSelected === dId) {
        setDeviceData((prev) => {
          if (!prev) return prev;
          const o = { ...(prev.latestTelemetry?.o || {}) };
          if (outletId) o[outletId] = status;
          return {
            ...prev,
            latestTelemetry: { ...(prev.latestTelemetry || {}), o },
            lastUpdate: nowIso,
            lastSeenAt: nowIso,
            status: 'online',
            isOnline: true,
          };
        });
      }
    });

    socket.on('ack', () => {
      const nowIso = new Date().toISOString();
      setDeviceData((prev) => (prev ? {
        ...prev,
        lastUpdate: nowIso,
        lastSeenAt: nowIso,
        status: 'online',
        isOnline: true,
      } : prev));

      setDevicesList((prev) => {
        if (!Array.isArray(prev) || !prev.length) return prev;
        return prev.map((item) => ({
          ...item,
          status: 'online',
          isOnline: true,
          lastSeenAt: nowIso,
        }));
      });
    });

    socket.on('device.status', ({ deviceId, status, isOnline, lastSeenAt }) => {
      try {
        const currentList = devicesListRef.current;
        const currentSelected = selectedDeviceRef.current;
        const deviceExists = currentList.some(d => d.deviceId === deviceId);
        
        if (!deviceExists) {
          return;
        }

        const statusValue = status === 'online' ? 'online' : 'offline';
        const deviceIsOnline = isOnline === true || status === 'online';

        setDevicesList((prev) => {
          if (!Array.isArray(prev) || !prev.length) return prev;
          return prev.map((item) => (item.deviceId === deviceId
            ? {
                ...item,
                status: statusValue,
                isOnline: deviceIsOnline,
                ...(lastSeenAt && { lastSeenAt }),
              }
            : item));
        });

        if (currentSelected === deviceId) {
          setDeviceData((prev) => (prev ? {
            ...prev,
            status: statusValue,
            isOnline: deviceIsOnline,
            ...(lastSeenAt && { lastSeenAt }),
          } : prev));
        }
      } catch (e) {
        log.error('device.status handler error', e?.message || e);
      }
    });

    socket.on('disconnect', () => {});

    return () => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch {}
        socketRef.current = null;
    };
  }, [fetchDevices]);
  const removeDevice = useCallback((deviceId, newSelectedDevice = null) => {
    setDevicesList(prev => (Array.isArray(prev) ? prev.filter(device => device.deviceId !== deviceId) : prev));
    if (selectedDevice === deviceId) {
      if (newSelectedDevice) {
        setSelectedDevice(newSelectedDevice);
        fetchDeviceStatus(newSelectedDevice);
      } else {
        setSelectedDevice(null);
        setDeviceData(null);
        setDeviceDetail(null);
      }
    } else {
      setDeviceDetail(prev => (prev?.deviceId === deviceId ? null : prev));
    }
  }, [selectedDevice, fetchDeviceStatus]);

  return {
    deviceData,
    deviceDetail,
    devicesList,
    selectedDevice,
    loading,
    error,
    currentPage,
    hasMore,
    loadingMore,
    totalPages,
    fetchDevices,
    loadMoreDevices,
    selectDevice,
    fetchDeviceStatus,
    fetchDeviceDetail,
    refreshDevices: () => fetchDevices(1, 20),
    removeDevice,
  };
};
