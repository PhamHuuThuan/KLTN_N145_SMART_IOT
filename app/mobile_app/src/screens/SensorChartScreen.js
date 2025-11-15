import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const SensorChartScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { selectedDevice } = useDeviceData();
  
  const [selectedSensor, setSelectedSensor] = useState('temperature');
  const [selectedTimeRange, setSelectedTimeRange] = useState(24); // hours
  const [telemetryData, setTelemetryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState(null);

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
        const MAX_LOAD_RECORDS = 1500;
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

  // Load telemetry data when device or time range changes
  useEffect(() => {
    let isMounted = true;
    
    if (selectedDevice) {
      loadTelemetryData().catch(err => {
        if (isMounted) {
          log.error('Error in loadTelemetryData:', err);
        }
      });
    } else {
      setTelemetryData([]);
    }
    
    return () => {
      isMounted = false;
    };
  }, [loadTelemetryData]);

  // Process data for chart
  const chartData = useMemo(() => {
    try {
      if (!telemetryData.length || !selectedSensor) return { labels: [], values: [], timestamps: [] };
      
      const sensorConfig = SENSOR_TYPES[selectedSensor];
      if (!sensorConfig) return { labels: [], values: [], timestamps: [] };
      
      // Limit processing to avoid crash with too much data
      const maxProcess = 1000; // Reduced to 1000 for better performance
      const limitedData = telemetryData.slice(0, maxProcess);
      
      // Process data with batch processing to avoid blocking
      const data = [];
      for (let i = 0; i < limitedData.length; i++) {
        try {
          const item = limitedData[i];
          const payload = item?.payload || {};
          const value = payload[sensorConfig.key];
          
          // Treat null/undefined as 0
          const numValue = (value === null || value === undefined) ? 0 : Number(value);
          if (isNaN(numValue)) continue;
          
          const timestamp = new Date(item?.createdAt || payload?.ts || Date.now());
          if (isNaN(timestamp.getTime())) continue;
          
          const label = formatTimeLabel(timestamp);
          if (!label) continue; // Skip if label is empty
          
          data.push({
            timestamp,
            value: numValue,
            label,
          });
        } catch (err) {
          log.warn('Error processing data item:', err);
          continue; // Skip this item
        }
      }
      
      // Sample data if too many points (> 150 points for better performance)
      const maxPoints = 150;
      let sampledData = data;
      if (data.length > maxPoints) {
        const step = Math.ceil(data.length / maxPoints);
        sampledData = [];
        for (let i = 0; i < data.length; i += step) {
          sampledData.push(data[i]);
        }
        // Always include last point
        if (sampledData[sampledData.length - 1] !== data[data.length - 1]) {
          sampledData.push(data[data.length - 1]);
        }
      }
      
      return {
        labels: sampledData.map(item => item.label).filter(Boolean),
        values: sampledData.map(item => item.value).filter(v => !isNaN(v)),
        timestamps: sampledData.map(item => item.timestamp),
      };
    } catch (error) {
      log.error('Error processing chart data:', error);
      return { labels: [], values: [], timestamps: [] };
    }
  }, [telemetryData, selectedSensor, t, formatTimeLabel]);

  const handleCustomDateRange = (startDate, endDate) => {
    setCustomDateRange({ startDate, endDate });
    setSelectedTimeRange(null); // Clear preset range
    setShowDatePicker(false);
  };

  const handlePresetRange = (hours) => {
    setSelectedTimeRange(hours);
    setCustomDateRange(null); // Clear custom range
  };

  const sensorConfig = SENSOR_TYPES[selectedSensor];
  const sensorColor = sensorConfig ? colors[sensorConfig.colorKey] || colors.primary : colors.primary;

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
            {/* Compact Controls Bar */}
            <View style={[styles.controlsBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Sensor Selector - Compact */}
              <View style={styles.controlsRow}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.compactSelector}
                >
                  {Object.entries(SENSOR_TYPES).map(([key, config]) => {
                    const isSelected = selectedSensor === key;
                    const itemColor = isSelected ? sensorColor : colors.textSecondary;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.compactButton,
                          {
                            backgroundColor: isSelected ? itemColor : colors.backgroundSecondary,
                            borderColor: isSelected ? itemColor : colors.border,
                          }
                        ]}
                        onPress={() => setSelectedSensor(key)}
                      >
                        <MaterialCommunityIcons 
                          name={config.icon} 
                          size={18} 
                          color={isSelected ? colors.white : itemColor} 
                        />
                        <Text 
                          style={[
                            styles.compactButtonText,
                            { 
                              color: isSelected ? colors.white : itemColor 
                            }
                          ]}
                        >
                          {t(config.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Time Range - Compact */}
              <View style={[styles.controlsRow, styles.controlsRowSpacing]}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.compactSelector}
                >
                  {TIME_RANGES.slice(0, 4).map((range) => {
                    const isSelected = selectedTimeRange === range.hours;
                    return (
                      <TouchableOpacity
                        key={range.hours}
                        style={[
                          styles.compactButton,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.backgroundSecondary,
                            borderColor: isSelected ? colors.primary : colors.border,
                          }
                        ]}
                        onPress={() => handlePresetRange(range.hours)}
                      >
                        <Text 
                          style={[
                            styles.compactButtonText,
                            { 
                              color: isSelected ? colors.white : colors.textSecondary 
                            }
                          ]}
                        >
                          {t(range.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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
                  <View>
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
                        {chartData.values[chartData.values.length - 1]?.toFixed(1)}
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
                  />
                )}
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsRowSpacing: {
    marginTop: 12,
  },
  controlsLabel: {
    width: 100,
    marginRight: 8,
  },
  controlsLabelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactSelector: {
    flex: 1,
    flexDirection: 'row',
  },
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
  },
  compactButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
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
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
});

export default SensorChartScreen;

