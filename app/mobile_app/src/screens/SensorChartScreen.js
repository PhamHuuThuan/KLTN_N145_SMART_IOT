import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useDeviceData } from '../hooks/useDeviceData';
import Header from '../components/Header';
import SensorChart from '../components/SensorChart';
import AnimatedNavBar from '../components/AnimatedNavBar';
import apiService from '../services/apiService';
import { createLogger } from '../utils/logger';

const log = createLogger('SensorChart');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SENSOR_TYPES = {
  temperature: { key: 'temp', label: 'sensors.labels.temperature', unit: '°C', icon: 'thermometer', colorKey: 'danger' },
  humidity: { key: 'humid', label: 'sensors.labels.humidity', unit: '%', icon: 'water-percent', colorKey: 'info' },
  gas: { key: 'gas_ppm', label: 'sensors.labels.gasLevel', unit: 'ppm', icon: 'molecule-co2', colorKey: 'warning' },
  smoke: { key: 'smoke', label: 'sensors.labels.smoke', unit: '', icon: 'smoke-detector', colorKey: 'danger' },
};

const TIME_RANGES = [
  { hours: 12, label: 'charts.timeRange.12hours' },
  { hours: 24, label: 'charts.timeRange.24hours' },
  { hours: 168, label: 'charts.timeRange.7days' },
  { hours: 720, label: 'charts.timeRange.30days' },
];

const SensorChartScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  
  const routeDeviceId = route?.params?.deviceId;
  const { selectedDevice: hookSelectedDevice, deviceData, devicesList, selectDevice } = useDeviceData();
  
  const selectedDevice = routeDeviceId || hookSelectedDevice;
  
  useEffect(() => {
    if (routeDeviceId) {
      selectDevice(routeDeviceId);
    }
  }, [routeDeviceId, selectDevice]);
  
  const [selectedSensor, setSelectedSensor] = useState('temperature');
  const [selectedTimeRange, setSelectedTimeRange] = useState(24); // hours
  const [telemetryData, setTelemetryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const loadDataTimeoutRef = useRef(null);

  // Format time label for chart
  const formatTimeLabel = useCallback((timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      if (isNaN(diffMs) || diffMs < 0) {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      }
      
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m`;
      } else if (diffHours < 24) {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }) + ' ' +
               date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (err) {
      log.warn('Error formatting time label:', err);
      return '';
    }
  }, []);

  const loadTelemetryData = useCallback(async () => {
    if (!selectedDevice) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const hours = customDateRange 
        ? Math.ceil((customDateRange.endDate - customDateRange.startDate) / (1000 * 60 * 60))
        : selectedTimeRange;
      
      log.info(`Loading telemetry data for device ${selectedDevice}, hours: ${hours}`);
      
      const response = await apiService.getTelemetryHistory(selectedDevice, hours);
      
      if (response.success && response.data) {
        let data = Array.isArray(response.data) ? response.data : [];
        
        // Limit data immediately to prevent memory issues
        const MAX_LOAD_RECORDS = 100000;
        if (data.length > MAX_LOAD_RECORDS) {
          log.warn(`Limiting data from ${data.length} to ${MAX_LOAD_RECORDS} records`);
          data = data.slice(0, MAX_LOAD_RECORDS);
        }
        
        // Filter by custom date range if set
        if (customDateRange) {
          data = data.filter(item => {
            try {
              const itemDate = new Date(item.createdAt || item.payload?.ts);
              if (isNaN(itemDate.getTime())) return false;
              return itemDate >= customDateRange.startDate && itemDate <= customDateRange.endDate;
            } catch {
              return false;
            }
          });
        }
        
        // Sort by timestamp ascending with error handling
        try {
          data.sort((a, b) => {
            try {
              const timeA = new Date(a.createdAt || a.payload?.ts || 0).getTime();
              const timeB = new Date(b.createdAt || b.payload?.ts || 0).getTime();
              if (isNaN(timeA) || isNaN(timeB)) return 0;
              return timeA - timeB;
            } catch {
              return 0;
            }
          });
        } catch (sortErr) {
          log.error('Error sorting data:', sortErr);
        }
        
        // Only set data if we have valid data
        if (data.length > 0) {
          setTelemetryData(data);
          log.info(`Loaded ${data.length} telemetry records`);
        } else {
          setTelemetryData([]);
          log.info('No valid telemetry records after processing');
        }
      } else {
        setTelemetryData([]);
      }
    } catch (err) {
      log.error('Error loading telemetry data:', err);
      setError(err.message || t('charts.loadError'));
      setTelemetryData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, selectedTimeRange, customDateRange, t]);

  // Helper function to check sensor data availability
  const checkSensorDataAvailability = useCallback(() => {
    if (!telemetryData.length) {
      return {};
    }
    
    const sensorDataAvailability = {};
    Object.keys(SENSOR_TYPES).forEach(sensorKey => {
      const sensorConfig = SENSOR_TYPES[sensorKey];
      const hasData = telemetryData.some(item => {
        const payload = item?.payload || {};
        const value = payload[sensorConfig.key];
        return value !== null && value !== undefined && !isNaN(Number(value)) && isFinite(Number(value));
      });
      sensorDataAvailability[sensorKey] = hasData;
    });
    
    return sensorDataAvailability;
  }, [telemetryData]);

  // Auto-select sensor with available data when telemetry data is loaded
  useEffect(() => {
    if (!telemetryData.length) {
      return;
    }
    
    const sensorDataAvailability = checkSensorDataAvailability();
    log.info('Sensor data availability:', sensorDataAvailability);
    
    // Check if current selected sensor has data
    const currentHasData = sensorDataAvailability[selectedSensor];
    
    // If current sensor has no data, select first available sensor
    if (!currentHasData) {
      const firstAvailableSensor = Object.keys(sensorDataAvailability).find(
        key => sensorDataAvailability[key]
      );
      if (firstAvailableSensor && firstAvailableSensor !== selectedSensor) {
        log.info(`Auto-selecting sensor: ${firstAvailableSensor} (current: ${selectedSensor} has no data)`);
        setSelectedSensor(firstAvailableSensor);
      }
    }
  }, [telemetryData, checkSensorDataAvailability]); // Only depend on telemetryData to avoid loops

  // Also check when selectedSensor changes (user manually selects)
  useEffect(() => {
    if (!telemetryData.length) {
      return;
    }
    
    const sensorDataAvailability = checkSensorDataAvailability();
    const currentHasData = sensorDataAvailability[selectedSensor];
    
    // If user selected a sensor with no data, auto-switch to first available
    if (!currentHasData) {
      const firstAvailableSensor = Object.keys(sensorDataAvailability).find(
        key => sensorDataAvailability[key]
      );
      if (firstAvailableSensor && firstAvailableSensor !== selectedSensor) {
        log.info(`Switching from ${selectedSensor} (no data) to ${firstAvailableSensor}`);
        setSelectedSensor(firstAvailableSensor);
      }
    }
  }, [selectedSensor, checkSensorDataAvailability]);

  useEffect(() => {
    // Clear any pending timeout
    if (loadDataTimeoutRef.current) {
      clearTimeout(loadDataTimeoutRef.current);
    }
    
    let isMounted = true;
    
    if (selectedDevice) {
      loadDataTimeoutRef.current = setTimeout(() => {
        if (isMounted) {
          loadTelemetryData().catch(err => {
            if (isMounted) {
              log.error('Error in loadTelemetryData:', err);
            }
          });
        }
      }, 150); // Small delay to let UI update first
    } else {
      setTelemetryData([]);
    }
    
    return () => {
      isMounted = false;
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }
    };
  }, [loadTelemetryData, selectedDevice]); // Only reload when device or time range changes, not sensor

  // Process data for chart
  const chartData = useMemo(() => {
    try {
      if (!telemetryData.length || !selectedSensor) return { labels: [], values: [], timestamps: [] };
      
      const sensorConfig = SENSOR_TYPES[selectedSensor];
      if (!sensorConfig) return { labels: [], values: [], timestamps: [] };
      
      // Special handling for smoke sensor (binary: 0 or 1)
      const isSmokeSensor = selectedSensor === 'smoke';
      
      // First pass: find minValue and maxValue from valid values (only for non-smoke sensors)
      // For smoke sensor, minValue is always 0 and maxValue is always 1
      let minValue = 0;
      let maxValue = 1;
      
      if (!isSmokeSensor) {
        minValue = Infinity;
        maxValue = -Infinity;
        const validValues = [];
        
        for (let i = 0; i < telemetryData.length; i++) {
          try {
            const item = telemetryData[i];
            const payload = item?.payload || {};
            const value = payload[sensorConfig.key];
            
            if (value !== null && value !== undefined) {
              const numValue = Number(value);
              if (!isNaN(numValue) && isFinite(numValue)) {
                validValues.push(numValue);
                if (numValue < minValue) {
                  minValue = numValue;
                }
                if (numValue > maxValue) {
                  maxValue = numValue;
                }
              }
            }
          } catch (err) {
            // Skip invalid items
          }
        }
        
        // If no valid values found, use default range
        if (minValue === Infinity || validValues.length === 0) {
          minValue = 0;
          maxValue = 100;
        } else if (minValue === maxValue) {
          // If all values are the same, add some padding
          const padding = Math.max(1, Math.abs(minValue) * 0.1);
          minValue = minValue - padding;
          maxValue = maxValue + padding;
        }
      }
      
      // Second pass: process all data
      // For smoke sensor, include all points (even null/undefined as 0)
      // For other sensors, only include points with valid values
      const data = [];
      for (let i = 0; i < telemetryData.length; i++) {
        try {
          const item = telemetryData[i];
          const payload = item?.payload || {};
          const value = payload[sensorConfig.key];
          
          const timestamp = new Date(item?.createdAt || payload?.ts || Date.now());
          if (isNaN(timestamp.getTime())) continue;
          
          // For smoke sensor, always include (null/undefined = 0)
          if (isSmokeSensor) {
            let numValue = 0;
            if (value !== null && value !== undefined) {
              const parsed = Number(value);
              if (!isNaN(parsed) && isFinite(parsed)) {
                numValue = parsed > 0 ? 1 : 0;
              }
            }
            
            const label = formatTimeLabel(timestamp);
            if (!label) continue;
            
            data.push({
              timestamp,
              value: numValue,
              label,
              isGapPoint: false,
            });
          } else {
            // For other sensors, only include valid values
            if (value === null || value === undefined) {
              continue; // Skip null/undefined values for non-smoke sensors
            }
            
            const numValue = Number(value);
            if (isNaN(numValue) || !isFinite(numValue)) {
              continue; // Skip invalid numbers
            }
            
            const label = formatTimeLabel(timestamp);
            if (!label) continue;
            
            data.push({
              timestamp,
              value: numValue,
              label,
              isGapPoint: false,
            });
          }
        } catch (err) {
          log.warn('Error processing data item:', err);
          continue; // Skip this item
        }
      }
      
      data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      let timeThreshold = 10 * 60 * 1000;
      if (customDateRange) {
        const rangeMs = customDateRange.endDate.getTime() - customDateRange.startDate.getTime();
        timeThreshold = Math.max(10 * 60 * 1000, rangeMs * 0.05);
      } else if (selectedTimeRange) {
        const rangeMs = selectedTimeRange * 60 * 60 * 1000;
        timeThreshold = Math.max(10 * 60 * 1000, rangeMs * 0.05);
      }
      
      const filledData = [];
      for (let i = 0; i < data.length; i++) {
        filledData.push(data[i]);
        
        if (i < data.length - 1) {
          const currentTime = data[i].timestamp.getTime();
          const nextTime = data[i + 1].timestamp.getTime();
          const gap = nextTime - currentTime;
          
          if (gap > timeThreshold) {
            // Insert gap point at start of gap
            const gapStartTime = new Date(currentTime + 1000);
            const gapStartLabel = formatTimeLabel(gapStartTime);
            if (gapStartLabel) {
              filledData.push({
                timestamp: gapStartTime,
                value: 0,
                label: gapStartLabel,
                isGapPoint: true,
              });
            }
            // Insert gap point at end of gap
            const gapEndTime = new Date(nextTime - 1000);
            const gapEndLabel = formatTimeLabel(gapEndTime);
            if (gapEndLabel) {
              filledData.push({
                timestamp: gapEndTime,
                value: 0,
                label: gapEndLabel,
                isGapPoint: true,
              });
            }
          }
        }
      }
      
      // Sort again after inserting gap points
      filledData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      log.info(`Chart data for ${selectedSensor}: ${filledData.length} points, range: [${minValue}, ${maxValue}]`);
      
      return {
        labels: filledData.map(item => item.label || ''),
        values: filledData.map(item => item.value),
        timestamps: filledData.map(item => item.timestamp),
        isGapPoints: filledData.map(item => item.isGapPoint || false),
      };
    } catch (error) {
      log.error('Error processing chart data:', error);
      return { labels: [], values: [], timestamps: [] };
    }
  }, [telemetryData, selectedSensor, formatTimeLabel, customDateRange, selectedTimeRange]);

  const handlePresetRange = (hours) => {
    // Update UI immediately - don't wait for data load
    setSelectedTimeRange(hours);
    setCustomDateRange(null);
    setSelectedLog(null);
    // Data will be loaded by useEffect with debounce
  };

  const handlePointSelect = useCallback((point, rawData) => {
    if (!point || !point.timestamp) {
      setSelectedLog(null);
      return;
    }

    const timestamp = new Date(point.timestamp);
    if (isNaN(timestamp.getTime())) {
      setSelectedLog(null);
      return;
    }

    // Check if this is a gap point (no data)
    if (point.isGapPoint) {
      setSelectedLog({
        payload: {
          temp: 0,
          humid: 0,
          gas_ppm: 0,
          smoke: 0,
          ts: point.timestamp.getTime(),
        },
        createdAt: point.timestamp,
        selectedValue: 0,
        selectedTimestamp: point.timestamp,
        isGapPoint: true, // Mark as gap point
      });
      return;
    }

    const matchingLog = telemetryData.find(log => {
      const logTime = new Date(log.createdAt || log.payload?.ts);
      if (isNaN(logTime.getTime())) return false;
      return logTime.getTime() === timestamp.getTime();
    });

    if (matchingLog) {
      setSelectedLog({
        ...matchingLog,
        selectedValue: point.value,
        selectedTimestamp: point.timestamp,
        isGapPoint: false,
      });
    } else {
      setSelectedLog({
        payload: {
          temp: selectedSensor === 'temperature' ? point.value : 0,
          humid: selectedSensor === 'humidity' ? point.value : 0,
          gas_ppm: selectedSensor === 'gas' ? point.value : 0,
          smoke: selectedSensor === 'smoke' ? point.value : 0,
          ts: point.timestamp.getTime(),
        },
        createdAt: point.timestamp,
        selectedValue: point.value,
        selectedTimestamp: point.timestamp,
        isGapPoint: false,
      });
    }
  }, [telemetryData, selectedSensor]);

  const sensorConfig = SENSOR_TYPES[selectedSensor];
  const sensorColor = sensorConfig ? colors[sensorConfig.colorKey] || colors.primary : colors.primary;

  const deviceName = useMemo(() => {
    if (!selectedDevice) return null;
    if (deviceData?.name) return deviceData.name;
    const device = devicesList.find(d => d.deviceId === selectedDevice);
    return device?.name || selectedDevice;
  }, [selectedDevice, deviceData, devicesList]);

  const chartTimeRange = useMemo(() => {
    if (customDateRange) {
      return {
        startTime: customDateRange.startDate,
        endTime: customDateRange.endDate,
      };
    } else if (selectedTimeRange) {
      const now = new Date();
      const startTime = new Date(now.getTime() - selectedTimeRange * 60 * 60 * 1000);
      return {
        startTime,
        endTime: now,
      };
    }
    return null;
  }, [customDateRange, selectedTimeRange]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isDarkMode ? 'light-content' : 'dark-content'} />
      
      <Header 
        title={t('charts.title')}
        onBack={() => navigation?.goBack?.() || navigation?.navigate?.('Home')}
      />
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!selectedDevice ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons 
              name="chart-line" 
              size={64} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              {t('charts.selectDevice')}
            </Text>
          </View>
        ) : (
          <>
            {/* Animated Controls Bar */}
            <View style={[styles.controlsBar, { backgroundColor: 'transparent' }]}>
              {/* Sensor Selector - Animated NavBar */}
              <View style={styles.controlsRow}>
                <AnimatedNavBar
                  items={Object.entries(SENSOR_TYPES).map(([sensorKey, config]) => {
                    // sensorKey is 'temperature', 'humidity', 'gas', 'smoke'
                    // config.key is 'temp', 'humid', 'gas_ppm', 'smoke' (field name in payload)
                    // We need to use sensorKey as the item key, not config.key
                    return {
                      ...config,
                      sensorKey, // Store sensor key separately
                      key: sensorKey, // This is what we use for selection
                    };
                  })}
                  selectedValue={selectedSensor}
                  onSelect={(key) => {
                    // Update UI immediately - don't wait for data load
                    setSelectedSensor(key);
                    setSelectedLog(null); // Clear selected log when switching sensor
                    // Data will be loaded by useEffect with debounce
                  }}
                  getItemKey={(item) => {
                    // Ensure we get the correct key
                    return item?.key;
                  }}
                  getItemLabel={(item) => t(item.label)}
                  getItemIcon={(item) => item.icon}
                  getItemColor={(item) => {
                    const config = SENSOR_TYPES[item.key];
                    return config ? colors[config.colorKey] || colors.primary : colors.primary;
                  }}
                  horizontal={true}
                  style={styles.navBar}
                />
              </View>

              {/* Time Range - Animated NavBar */}
              <View style={[styles.controlsRow, styles.controlsRowSpacing]}>
                <AnimatedNavBar
                  items={TIME_RANGES.slice(0, 4)}
                  selectedValue={selectedTimeRange}
                  onSelect={(hours) => handlePresetRange(hours)}
                  getItemKey={(item) => item.hours}
                  getItemLabel={(item) => t(item.label)}
                  getItemColor={() => colors.primary}
                  horizontal={true}
                  style={styles.navBar}
                />
              </View>

              {/* Custom Range Display */}
              {customDateRange && (
                <View style={[styles.customRangeDisplay, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.customRangeText, { color: colors.textSecondary }]}>
                    {customDateRange.startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - {customDateRange.endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setCustomDateRange(null);
                      setSelectedTimeRange(24);
                    }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Chart */}
            {loading ? (
              <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('charts.loading')}
                </Text>
              </View>
            ) : error ? (
              <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
                <MaterialCommunityIcons name="alert-circle" size={48} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: colors.primary }]}
                  onPress={loadTelemetryData}
                >
                  <Text style={[styles.retryButtonText, { color: colors.white }]}>
                    {t('common.retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : chartData.labels.length === 0 ? (
              <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
                <MaterialCommunityIcons name="chart-line-variant" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('charts.noData')}
                </Text>
              </View>
            ) : (
              <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
                <View style={styles.chartHeader}>
                  <View style={styles.chartHeaderLeft}>
                    {deviceName && (
                      <View style={styles.deviceNameContainer}>
                        <MaterialCommunityIcons 
                          name="devices" 
                          size={16} 
                          color={colors.primary} 
                          style={styles.deviceIcon}
                        />
                        <Text style={[styles.deviceName, { color: colors.primary }]} numberOfLines={1}>
                          {deviceName}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.chartTitle, { color: colors.text }]}>
                      {t(sensorConfig.label)}
                    </Text>
                    <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                      {chartData.values.length} {t('charts.dataPoints')}
                    </Text>
                  </View>
                  {chartData.values.length > 0 && (
                    <View style={[styles.statBox, { backgroundColor: colors.backgroundSecondary }]}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        {t('charts.current')}
                      </Text>
                      <Text style={[styles.statValue, { color: sensorColor }]}>
                        {selectedSensor === 'smoke' 
                          ? chartData.values[chartData.values.length - 1] 
                          : chartData.values[chartData.values.length - 1]?.toFixed(1)}
                        {sensorConfig.unit}
                      </Text>
                    </View>
                  )}
                </View>
                {chartData.labels.length > 0 && chartData.values.length > 0 && (
                  <SensorChart
                    data={chartData}
                    color={sensorColor}
                    unit={sensorConfig.unit}
                    height={250}
                    onPointSelect={handlePointSelect}
                    rawData={telemetryData}
                    timeRange={chartTimeRange}
                    isBinary={selectedSensor === 'smoke'}
                  />
                )}
              </View>
            )}
            
            {/* Selected Log Detail */}
            {selectedLog && (
              <View style={[styles.logDetailContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.logDetailHeader, { borderBottomColor: colors.border }]}>
                  <MaterialCommunityIcons name="information" size={20} color={colors.primary} />
                  <Text style={[styles.logDetailTitle, { color: colors.text }]}>
                    {t('charts.logDetail')}
                  </Text>
                </View>
                
                <View style={styles.logDetailContent}>
                  {/* Time */}
                  <View style={styles.logDetailRow}>
                    <Text style={[styles.logDetailLabel, { color: colors.textSecondary }]}>
                      {t('charts.time')}:
                    </Text>
                    <Text style={[styles.logDetailValue, { color: colors.text }]}>
                      {selectedLog.selectedTimestamp
                        ? new Date(selectedLog.selectedTimestamp).toLocaleString('vi-VN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : selectedLog.createdAt
                        ? new Date(selectedLog.createdAt).toLocaleString('vi-VN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '-'}
                    </Text>
                  </View>
                  
                  {/* Selected Sensor Value */}
                  <View style={styles.logDetailRow}>
                    <Text style={[styles.logDetailLabel, { color: colors.textSecondary }]}>
                      {t(sensorConfig.label)}:
                    </Text>
                    <Text style={[styles.logDetailValue, { color: sensorColor, fontWeight: 'bold' }]}>
                      {selectedLog.isGapPoint 
                        ? (t('charts.noData') || 'Không có thông tin')
                        : (selectedSensor === 'smoke' 
                            ? selectedLog.selectedValue 
                            : selectedLog.selectedValue?.toFixed(1) || '0') + sensorConfig.unit}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  controlsBar: {
    marginBottom: 15,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsRowSpacing: {
    marginTop: 12,
  },
  navBar: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  customRangeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  chartContainer: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
    width: '100%',
  },
  chartHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  deviceNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  deviceIcon: {
    marginRight: 6,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  chartSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  statBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logDetailContainer: {
    borderRadius: 16,
    padding: 20,
    marginTop: 15,
    marginBottom: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  logDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
  },
  logDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  logDetailContent: {
    gap: 16,
  },
  logDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  logDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
  logDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  logDetailDivider: {
    height: 1.5,
    marginVertical: 12,
    opacity: 0.3,
  },
  logDetailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 4,
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  logDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  logDetailGridItem: {
    flex: 1,
    minWidth: '47%',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  logDetailGridLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.7,
  },
  logDetailGridValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
});

export default SensorChartScreen;

