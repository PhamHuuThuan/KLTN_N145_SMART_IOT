import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import rulesService from '../services/rulesService';
import apiService from '../services/apiService';

export const useRulesData = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await apiService.getDevices();
      const list = res?.data || [];
      const deviceIds = list.map(d => d.deviceId);
      setDevices(deviceIds);
      return deviceIds;
    } catch (e) {
      console.error('Failed to load devices for RulesScreen:', e);
      setDevices([]);
      return [];
    }
  };

  const loadRules = async (selectedDevice) => {
    try {
      console.log('Loading rules for user:', user?.id);
      const params = selectedDevice ? { deviceId: selectedDevice } : {};
      const response = await rulesService.getAllRules(user?.id, params);
      console.log('Rules response:', response);
      
      if (response.success) {
        const items = response.data || [];
        setRules(items);
        console.log('Rules loaded successfully:', response.data?.length || 0, 'rules');
      } else {
        console.error('Failed to load rules:', response.message);
        setRules([]);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
      setRules([]);
    }
  };

  const loadTemplates = async () => {
    try {
      console.log('Loading rule templates...');
      const response = await rulesService.getRuleTemplates();
      console.log('Templates response:', response);
      
      if (response.success) {
        setTemplates(response.data || []);
        console.log('Templates loaded successfully:', response.data?.length || 0, 'templates');
      } else {
        console.error('Failed to load templates:', response.message);
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
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
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load rules data');
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
  }, []);

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
