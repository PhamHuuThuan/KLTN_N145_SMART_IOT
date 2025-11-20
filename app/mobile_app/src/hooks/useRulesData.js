import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import rulesService from '../services/rulesService';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';
import { getRuleTemplates } from '../constants/ruleTemplates';
import { useLanguage } from './useLanguage';

const log = createLogger('useRulesData');

// Normalize device status like useDeviceData does
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

export const useRulesData = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await apiService.getDevices();
      const list = res?.data || [];
      // Normalize devices with status like useDeviceData does
      const normalizedDevices = list.map(device => {
        const onlineState = computeOnlineState(device);
        return {
          ...device,
          ...onlineState,
          deviceId: device.deviceId,
          name: device.name,
          lastSeenAt: device.lastSeenAt || device.lastUpdate || null,
        };
      });
      setDevices(normalizedDevices);
      return normalizedDevices;
    } catch (e) {
      log.error('Failed to load devices for RulesScreen:', e);
      setDevices([]);
      return [];
    }
  };

  const loadRules = async (selectedDevice) => {
    try {
      log.info('Loading rules for device:', selectedDevice);
      const params = selectedDevice ? { deviceId: selectedDevice } : {};
      const response = await rulesService.getAllRules(params, token);
      log.debug('Rules response:', response);
      
      if (response.success) {
        const items = response.data || [];
        setRules(items);
        log.info('Rules loaded successfully:', response.data?.length || 0, 'rules');
      } else {
        log.error('Failed to load rules:', response.message);
        setRules([]);
      }
    } catch (error) {
      log.error('Error loading rules:', error);
      setRules([]);
    }
  };

  const loadTemplates = async () => {
    try {
      log.info('Loading rule templates from frontend...');
      const templatesData = getRuleTemplates(language);
      const templatesArray = Object.entries(templatesData).map(([key, template]) => ({
        ...template,
        key // Add key for reference
      }));
      setTemplates(templatesArray);
      log.info('Templates loaded successfully:', templatesArray.length, 'templates');
    } catch (error) {
      log.error('Error loading templates:', error);
      setTemplates([]);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRules(),
        loadTemplates()
      ]);
    } catch (error) {
      log.error('Error loading data:', error);
      log.error('Failed to load rules data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), fetchDevices()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    fetchDevices();
  }, [language]); // Reload when language changes

  return {
    rules,
    templates,
    devices,
    loading,
    refreshing,
    loadRules,
    loadTemplates,
    loadData,
    onRefresh,
    fetchDevices
  };
};
