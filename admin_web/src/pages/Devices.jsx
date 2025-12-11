import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import devicesService from '../services/devicesService';

function Devices() {
  const { t } = useTranslation();
  const [allDevices, setAllDevices] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [filter, setFilter] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const qrContainerRef = useRef(null);

  const [chartError, setChartError] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState('temperature');
  const [selectedRange, setSelectedRange] = useState(12);
  const [showJsonData, setShowJsonData] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const loadTelemetryRequestId = useRef(0);

  // Thresholds for sensor levels
  const THRESHOLDS = {
    temperature: { low: 15, normal: 40, high: 50 },
    humidity: { low: 30, normal: 80, high: 90 },
    gas: { low: 300, normal: 800, high: 1000 },
  };

  const getSensorLevel = (value, thresholds) => {
    if (value === null || value === undefined) return 'normal';
    if (value < thresholds.low) return 'low';
    if (value < thresholds.normal) return 'normal';
    if (value < thresholds.high) return 'high';
    return 'veryHigh';
  };

  // Level colors for dots
  const LEVEL_DOT_COLORS = {
    low: '#1976D2',      // Blue
    normal: '#757575',   // Gray
    high: '#F57C00',     // Orange
    veryHigh: '#D32F2F'  // Red
  };

  // Custom dot component with color based on level
  const renderDot = (props, sensorKey, thresholds, isSmoke) => {
    const { cx, cy, payload } = props;
    const value = payload[sensorKey];
    
    if (value == null || isNaN(value)) return null;

    let level;
    if (isSmoke) {
      level = Number(value) >= 1 ? 'veryHigh' : 'normal';
    } else {
      level = getSensorLevel(value, thresholds);
    }

    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={LEVEL_DOT_COLORS[level]}
        stroke="#fff"
        strokeWidth={1.5}
      />
    );
  };

  useEffect(() => {
    fetchDevices();
  }, [filter]);

  const isDeviceOnline = (device) => {
    if (!device) return false;
    
    if (device.status === 'online') return true;
    if (device.status === 'offline') return false;
    
    if (device.lastSeenAt) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const lastSeen = new Date(device.lastSeenAt);
      return lastSeen > fiveMinutesAgo;
    }
    
    return false;
  };

  const fetchDevices = async () => {
    try {
      const response = await devicesService.getAllDevices({ limit: 1000 });
      const allDevicesData = response.data || [];
      
      setAllDevices(allDevicesData);
      
      let filteredDevices = allDevicesData;
      if (filter === 'online') {
        filteredDevices = allDevicesData.filter(d => isDeviceOnline(d));
      } else if (filter === 'offline') {
        filteredDevices = allDevicesData.filter(d => !isDeviceOnline(d));
      }
      
      setDevices(filteredDevices);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#27AE60';
      case 'offline': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const currentLanguage = localStorage.getItem('admin-language') || 'vi';
    return new Date(date).toLocaleString(currentLanguage === 'vi' ? 'vi-VN' : 'en-US');
  };

  const formatTimeLabel = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const currentLanguage = localStorage.getItem('admin-language') || 'vi';
      const locale = currentLanguage === 'vi' ? 'vi-VN' : 'en-US';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      if (isNaN(diffMs) || diffMs < 0) {
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      }
      
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Always show specific time (HH:mm format)
      if (diffHours < 24) {
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ' ' +
               date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      }
    } catch (err) {
      console.warn('Error formatting time label:', err);
      return '';
    }
  };

  const loadTelemetry = async (deviceId, hours = 24) => {
    if (!deviceId) return;
    
    const currentRequestId = ++loadTelemetryRequestId.current;
    
    try {
      setChartLoading(true);
      setChartError(null);
      setChartData([]);

      let response = await devicesService.getTelemetryHistory(deviceId, hours);
      
      if (response.success === false && response.error && response.error.includes('Path collision')) {
        const sensorTypes = ['temperature', 'humidity', 'gas', 'smoke'];
        const allDataMap = new Map();
        
        for (const sensorType of sensorTypes) {
          try {
            const sensorResponse = await devicesService.getTelemetryHistory(deviceId, hours, sensorType);
            if (sensorResponse.success && Array.isArray(sensorResponse.data)) {
              for (const item of sensorResponse.data) {
                const timestamp = item.createdAt || item.payload?.ts;
                if (!timestamp) continue;
                
                const timeKey = new Date(timestamp).getTime();
                if (isNaN(timeKey)) continue;
                
                if (allDataMap.has(timeKey)) {
                  const existing = allDataMap.get(timeKey);
                  existing.payload = {
                    ...existing.payload,
                    ...item.payload
                  };
                } else {
                  allDataMap.set(timeKey, { ...item });
                }
              }
            }
          } catch (err) {
          }
        }
        
        const allData = Array.from(allDataMap.values());
        allData.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.payload?.ts || 0).getTime();
          const timeB = new Date(b.createdAt || b.payload?.ts || 0).getTime();
          return timeA - timeB;
        });
        
        response = {
          success: true,
          data: allData
        };
      }
      
      if (!response) {
        throw new Error('No response from server');
      }
      
      if (response.success === false) {
        let errorMsg = 'Không thể tải dữ liệu biểu đồ';
        const backendError = response.error || response.message || '';
        
        if (backendError.includes('Path collision')) {
          errorMsg = 'Lỗi cấu hình backend: Xung đột đường dẫn dữ liệu. Vui lòng liên hệ quản trị viên.';
        } else if (backendError.includes('not found') || backendError.includes('Device not found')) {
          errorMsg = 'Không tìm thấy thiết bị';
        } else if (backendError.includes('Access denied') || backendError.includes('403')) {
          errorMsg = 'Không có quyền truy cập thiết bị này';
        } else if (response.status === 500) {
          errorMsg = 'Lỗi máy chủ (500). Vui lòng thử lại sau.';
          if (backendError) {
            errorMsg += ` Chi tiết: ${backendError}`;
          }
        } else if (response.status) {
          errorMsg = `Lỗi ${response.status}: ${backendError || 'Không thể tải dữ liệu'}`;
        } else if (backendError) {
          errorMsg = backendError;
        }
        
        console.error('API returned error:', errorMsg);
        
        if (currentRequestId === loadTelemetryRequestId.current) {
          setChartError(errorMsg);
          setChartData([]);
        }
        return;
      }
      
      let items = [];
      if (Array.isArray(response.data)) {
        items = response.data;
      } else if (Array.isArray(response)) {
        items = response;
      } else if (response.data && Array.isArray(response.data)) {
        items = response.data;
      } else {
        items = [];
      }
      
      items = items.filter(item => {
        try {
          const timestamp = item.createdAt || item.payload?.ts;
          if (!timestamp) return false;
          const itemDate = new Date(timestamp);
          return !isNaN(itemDate.getTime());
        } catch {
          return false;
        }
      });
      
      try {
        items.sort((a, b) => {
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
        console.error('Error sorting data:', sortErr);
      }
      
      const processed = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const payload = item?.payload || {};
          
          const timestamp = new Date(item?.createdAt || payload?.ts || Date.now());
          if (isNaN(timestamp.getTime())) continue;
          
          const timeLabel = formatTimeLabel(timestamp);
          if (!timeLabel) continue;
          
          const temp = payload.temp;
          const humid = payload.humid;
          const gas = payload.gas_ppm;
          const smoke = payload.smoke;
          
          const processedItem = {
            time: timeLabel,
            timestamp: timestamp.getTime(),
          };
          
          let hasAnyValue = false;
          
          if (temp !== null && temp !== undefined) {
            const numTemp = Number(temp);
            if (!isNaN(numTemp) && isFinite(numTemp)) {
              processedItem.temperature = numTemp;
              hasAnyValue = true;
            }
          }
          
          if (humid !== null && humid !== undefined) {
            const numHumid = Number(humid);
            if (!isNaN(numHumid) && isFinite(numHumid)) {
              processedItem.humidity = numHumid;
              hasAnyValue = true;
            }
          }
          
          if (gas !== null && gas !== undefined) {
            const numGas = Number(gas);
            if (!isNaN(numGas) && isFinite(numGas)) {
              processedItem.gas = numGas;
              hasAnyValue = true;
            }
          }
          
          if (smoke !== null && smoke !== undefined) {
            const numSmoke = Number(smoke);
            if (!isNaN(numSmoke) && isFinite(numSmoke)) {
              processedItem.smoke = numSmoke;
              hasAnyValue = true;
            }
          }
          
          if (hasAnyValue) {
            processed.push(processedItem);
          }
        } catch (err) {
          continue;
        }
      }
      
      processed.sort((a, b) => a.timestamp - b.timestamp);
      
      if (currentRequestId === loadTelemetryRequestId.current) {
        setChartData(processed);
      }
    } catch (error) {
      if (currentRequestId !== loadTelemetryRequestId.current) {
        return;
      }
      
      console.error('Error loading telemetry:', error);
      let errorMessage = 'Failed to load telemetry data';
      if (error.response) {
        errorMessage = error.response.data?.message 
          || error.response.data?.error 
          || error.response.statusText
          || `Server error (${error.response.status})`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setChartError(errorMessage);
      setChartData([]);
    } finally {
      if (currentRequestId === loadTelemetryRequestId.current) {
        setChartLoading(false);
      }
    }
  };

  const downloadSelectedDeviceQr = () => {
    if (!selectedDevice?.deviceId || !qrContainerRef.current) return;

    try {
      const svg = qrContainerRef.current.querySelector('svg');
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');

        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `QR-${selectedDevice.deviceId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  useEffect(() => {
    if (selectedDevice?.deviceId) {
      loadTelemetry(selectedDevice.deviceId, selectedRange);
    } else {
      setChartData([]);
      setChartError(null);
    }
    setSelectedPoint(null);
  }, [selectedDevice, selectedRange, selectedSensor]);

  const handleDelete = async (deviceId, e) => {
    e.stopPropagation();
    if (!window.confirm(t('devices.deleteConfirm', { deviceId }))) {
      return;
    }

    try {
      await devicesService.deleteDevice(deviceId);
      alert(t('devices.deleteSuccess'));
      fetchDevices();
      if (selectedDevice?.deviceId === deviceId) {
        setSelectedDevice(null);
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      alert(error.response?.data?.message || t('devices.deleteError'));
    }
  };

  if (loading) {
    return <div style={styles.loading}>{t('devices.loading')}</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('devices.title')}</h1>
        <div style={styles.headerRight}>
          <Link to="/devices/new" style={styles.createButton}>
            + {t('devices.addDevice')}
          </Link>
        <div style={styles.filters}>
          <button
            onClick={() => setFilter('all')}
            style={{...styles.filterButton, ...(filter === 'all' && styles.filterButtonActive)}}
          >
            {t('devices.all')} ({allDevices.length})
          </button>
          <button
            onClick={() => setFilter('online')}
            style={{...styles.filterButton, ...(filter === 'online' && styles.filterButtonActive)}}
          >
            {t('devices.online')} ({allDevices.filter(d => isDeviceOnline(d)).length})
          </button>
          <button
            onClick={() => setFilter('offline')}
            style={{...styles.filterButton, ...(filter === 'offline' && styles.filterButtonActive)}}
          >
            {t('devices.offline')} ({allDevices.filter(d => !isDeviceOnline(d)).length})
          </button>
          </div>
        </div>
      </div>

      <div style={styles.devicesGrid}>
        {devices.map(device => (
          <div
            key={device._id}
            style={styles.deviceCard}
            onClick={() => setSelectedDevice(device)}
          >
            <div style={styles.deviceHeader}>
              <h3 style={styles.deviceName}>{device.name}</h3>
              <div style={styles.deviceHeaderRight}>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(device.status)
                  }}
                >
                  {device.status === 'online' ? t('devices.online') : t('devices.offline')}
                </span>
                <button
                  onClick={(e) => handleDelete(device.deviceId, e)}
                  style={styles.deleteButton}
                  title={t('devices.deleteDevice')}
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div style={styles.deviceInfo}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('devices.deviceId')}:</span>
                <span style={styles.infoValue}>{device.deviceId}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('devices.ownerId')}:</span>
                <span style={styles.infoValue}>{device.ownerId || t('devices.notAssigned')}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('devices.lastSeen')}:</span>
                <span style={styles.infoValue}>{formatDate(device.lastSeenAt)}</span>
              </div>
            </div>

            {device.latestTelemetry && (
              <div style={styles.telemetry}>
                <h4 style={styles.telemetryTitle}>{t('devices.sensorData')}</h4>
                <div style={styles.telemetryGrid}>
                  <div style={styles.telemetryItem}>
                    <span style={styles.telemetryLabel}>🌡️ {t('devices.temperature')}:</span>
                    <span style={styles.telemetryValue}>
                      {device.latestTelemetry.temp?.toFixed(1) || 'N/A'}°C
                    </span>
                  </div>
                  <div style={styles.telemetryItem}>
                    <span style={styles.telemetryLabel}>💧 {t('devices.humidity')}:</span>
                    <span style={styles.telemetryValue}>
                      {device.latestTelemetry.humid?.toFixed(1) || 'N/A'}%
                    </span>
                  </div>
                  <div style={styles.telemetryItem}>
                    <span style={styles.telemetryLabel}>🚬 {t('devices.smoke')}:</span>
                    <span style={styles.telemetryValue}>
                      {device.latestTelemetry.smoke !== null && device.latestTelemetry.smoke !== undefined 
                        ? (() => {
                            const smokeValue = Number(device.latestTelemetry.smoke);
                            const hasSmoke = smokeValue >= 1;
                            return hasSmoke ? t('devices.smokeDetected') : t('devices.smokeSafe');
                          })()
                        : 'N/A'}
                    </span>
                  </div>
                  <div style={styles.telemetryItem}>
                    <span style={styles.telemetryLabel}>🧪 {t('devices.gas')}:</span>
                    <span style={styles.telemetryValue}>
                      {device.latestTelemetry.gas_ppm || 'N/A'} ppm
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedDevice && (
        <div style={styles.modal} onClick={() => setSelectedDevice(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>{selectedDevice.name}</h2>
              <div style={styles.modalHeaderRight}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(selectedDevice.deviceId, e);
                  }}
                  style={styles.deleteButtonModal}
                >
                  🗑️ {t('devices.deleteDevice')}
                </button>
                <button onClick={() => setSelectedDevice(null)} style={styles.closeButton}>
                  ✕
                </button>
              </div>
            </div>
            <div style={styles.modalBody}>
              {selectedDevice?.deviceId && (
                <div style={styles.qrSection}>
                  <h3 style={styles.qrTitle}>{t('deviceEditor.qrCode')}</h3>
                  <p style={styles.qrDescription}>
                    {t('deviceEditor.qrDescription')}
                  </p>
                  <div style={styles.qrContainer} ref={qrContainerRef}>
                    <QRCodeSVG
                      value={selectedDevice.deviceId}
                      size={220}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div style={styles.qrActions}>
                    <button style={styles.qrDownloadButton} onClick={downloadSelectedDeviceQr}>
                      {t('deviceEditor.downloadQR')}
                    </button>
                  </div>
                </div>
              )}

              <div style={styles.chartSection}>
                <div style={styles.chartHeader}>
                  <div>
                    <h3 style={styles.chartTitle}>{t('devices.chartTitle')}</h3>
                    {selectedPoint && (
                      <div style={styles.selectedPointInfo}>
                        <div style={styles.selectedPointRow}>
                          <span style={styles.selectedPointLabel}>{t('devices.chartTime')}:</span>
                          <span style={styles.selectedPointValue}>{selectedPoint.time}</span>
                        </div>
                        <div style={styles.selectedPointRow}>
                          <span style={styles.selectedPointLabel}>{t('devices.chartValue')}:</span>
                          <span style={styles.selectedPointValue}>{selectedPoint.value} {selectedPoint.unit}</span>
                        </div>
                        <div style={styles.selectedPointRow}>
                          <span style={styles.selectedPointLabel}>{t('devices.chartLevel')}:</span>
                          <span style={styles.selectedPointValue}>{selectedPoint.levelLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={styles.chartControls}>
                    <div style={styles.sensorTabs}>
                      <button
                        style={{
                          ...styles.sensorTab,
                          ...(selectedSensor === 'temperature' && styles.sensorTabActive)
                        }}
                        onClick={() => setSelectedSensor('temperature')}
                      >
                        {t('devices.chartTemperature')}
                      </button>
                      <button
                        style={{
                          ...styles.sensorTab,
                          ...(selectedSensor === 'humidity' && styles.sensorTabActive)
                        }}
                        onClick={() => setSelectedSensor('humidity')}
                      >
                        {t('devices.chartHumidity')}
                      </button>
                      <button
                        style={{
                          ...styles.sensorTab,
                          ...(selectedSensor === 'gas' && styles.sensorTabActive)
                        }}
                        onClick={() => setSelectedSensor('gas')}
                      >
                        {t('devices.chartGas')}
                      </button>
                      <button
                        style={{
                          ...styles.sensorTab,
                          ...(selectedSensor === 'smoke' && styles.sensorTabActive)
                        }}
                        onClick={() => setSelectedSensor('smoke')}
                      >
                        {t('devices.chartSmoke')}
                      </button>
                    </div>
                    <div style={styles.rangeButtons}>
                      <button
                        style={{
                          ...styles.rangeButton,
                          ...(selectedRange === 12 && styles.rangeButtonActive)
                        }}
                        onClick={() => setSelectedRange(12)}
                      >
                        {t('devices.chartLast12h')}
                      </button>
                      <button
                        style={{
                          ...styles.rangeButton,
                          ...(selectedRange === 24 && styles.rangeButtonActive)
                        }}
                        onClick={() => setSelectedRange(24)}
                      >
                        {t('devices.chartLast24h')}
                      </button>
                      <button
                        style={{
                          ...styles.rangeButton,
                          ...(selectedRange === 168 && styles.rangeButtonActive)
                        }}
                        onClick={() => setSelectedRange(168)}
                      >
                        {t('devices.chartLast7d')}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={styles.chartBody}>
                  {chartLoading && (
                    <div style={styles.chartMessage}>{t('devices.chartLoading')}</div>
                  )}
                  {!chartLoading && chartError && (
                    <div style={styles.chartErrorContainer}>
                      <div style={styles.chartErrorMessage}>
                        ⚠️ {chartError}
                      </div>
                      <button
                        style={styles.retryButton}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#2980b9';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#3498db';
                        }}
                        onClick={() => {
                          setChartError(null);
                          if (selectedDevice?.deviceId) {
                            loadTelemetry(selectedDevice.deviceId, selectedRange);
                          }
                        }}
                      >
                        🔄 {t('devices.retry') || 'Thử lại'}
                      </button>
                    </div>
                  )}
                  {!chartLoading && !chartError && chartData.length === 0 && (
                    <div style={styles.chartMessage}>{t('devices.chartNoData')}</div>
                  )}
                  {!chartLoading && !chartError && chartData.length > 0 && (() => {
                    const sensorKey = selectedSensor === 'temperature' ? 'temperature' : 
                                     selectedSensor === 'humidity' ? 'humidity' :
                                     selectedSensor === 'gas' ? 'gas' : 'smoke';
                    const unit = selectedSensor === 'temperature' ? '°C' :
                                selectedSensor === 'humidity' ? '%' :
                                selectedSensor === 'gas' ? 'ppm' : 'V';
                    const isSmoke = selectedSensor === 'smoke';
                    const thresholds = THRESHOLDS[selectedSensor];
                    const sensorName = t(`devices.chart${selectedSensor.charAt(0).toUpperCase() + selectedSensor.slice(1)}`);

                    return (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart 
                          data={chartData} 
                          margin={{ top: 10, left: 0, right: 16, bottom: 0 }}
                          onClick={(data) => {
                            if (data?.activePayload?.[0]?.payload) {
                              const payload = data.activePayload[0].payload;
                              const value = payload[sensorKey];
                              if (value != null && !isNaN(value)) {
                                let levelLabel, displayValue;
                                if (isSmoke) {
                                  const hasSmoke = Number(value) >= 1;
                                  levelLabel = hasSmoke ? t('devices.legend.veryHigh') : t('devices.legend.normal');
                                  displayValue = hasSmoke ? t('devices.smokeDetected') : t('devices.smokeSafe');
                                } else {
                                  const level = getSensorLevel(value, thresholds);
                                  levelLabel = t(`devices.legend.${level}`);
                                  displayValue = Number(value).toFixed(2);
                                }
                                setSelectedPoint({
                                  time: payload.time,
                                  value: isSmoke ? displayValue : Number(payload[sensorKey]).toFixed(2),
                                  unit: isSmoke ? '' : unit,
                                  levelLabel: levelLabel
                                });
                              }
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip 
                            formatter={(value) => {
                              if (isSmoke) {
                                const hasSmoke = Number(value) >= 1;
                                return hasSmoke ? t('devices.smokeDetected') : t('devices.smokeSafe');
                              }
                              return `${Number(value).toFixed(2)} ${unit}`;
                            }}
                            labelFormatter={(label) => `${t('devices.chartTime')}: ${label}`}
                          />
                          <CartesianGrid strokeDasharray="3 3" />
                          <Legend formatter={() => sensorName} />
                          {selectedSensor === 'temperature' && (
                            <Line 
                              type="monotone" 
                              dataKey="temperature" 
                              stroke="#E74C3C" 
                              dot={(props) => renderDot(props, 'temperature', thresholds, false)}
                              activeDot={{ r: 6 }}
                              name={sensorName} 
                            />
                          )}
                          {selectedSensor === 'humidity' && (
                            <Line 
                              type="monotone" 
                              dataKey="humidity" 
                              stroke="#3498DB" 
                              dot={(props) => renderDot(props, 'humidity', thresholds, false)}
                              activeDot={{ r: 6 }}
                              name={sensorName} 
                            />
                          )}
                          {selectedSensor === 'gas' && (
                            <Line 
                              type="monotone" 
                              dataKey="gas" 
                              stroke="#F39C12" 
                              dot={(props) => renderDot(props, 'gas', thresholds, false)}
                              activeDot={{ r: 6 }}
                              name={sensorName} 
                            />
                          )}
                          {selectedSensor === 'smoke' && (
                            <Line 
                              type="monotone" 
                              dataKey="smoke" 
                              stroke="#8E44AD" 
                              dot={(props) => renderDot(props, 'smoke', null, true)}
                              activeDot={{ r: 6 }}
                              name={sensorName} 
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>

              <div style={styles.jsonSection}>
                <div 
                  style={styles.jsonHeader} 
                  onClick={() => setShowJsonData(!showJsonData)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <h3 style={styles.jsonTitle}>📋 Latest Telemetry Data</h3>
                  <button 
                    style={styles.toggleButton}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#2980b9';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#3498db';
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowJsonData(!showJsonData);
                    }}
                  >
                    {showJsonData ? '▲ Ẩn' : '▼ Hiện'}
                  </button>
                </div>
                {showJsonData && (
                  <pre style={styles.jsonData}>
                    {JSON.stringify(selectedDevice, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#2C3E50',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  filters: {
    display: 'flex',
    gap: '10px'
  },
  filterButton: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    backgroundColor: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  filterButtonActive: {
    backgroundColor: '#2C3E50',
    color: 'white',
    borderColor: '#2C3E50'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  devicesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px'
  },
  deviceCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  deviceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  deviceHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  },
  deleteButtonModal: {
    padding: '8px 16px',
    backgroundColor: '#E74C3C',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    marginRight: '8px',
    transition: 'background-color 0.2s'
  },
  modalHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  deviceName: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2C3E50',
    margin: 0
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'uppercase'
  },
  deviceInfo: {
    marginBottom: '16px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px'
  },
  infoLabel: {
    color: '#7f8c8d',
    fontWeight: '500'
  },
  infoValue: {
    color: '#2C3E50'
  },
  telemetry: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #eee'
  },
  telemetryTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '12px'
  },
  telemetryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  telemetryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px'
  },
  telemetryLabel: {
    color: '#7f8c8d'
  },
  telemetryValue: {
    color: '#2C3E50',
    fontWeight: '500'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'auto',
    width: '90%'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#7f8c8d'
  },
  modalBody: {
    maxHeight: '70vh',
    overflow: 'auto'
  },
  chartSection: {
    marginBottom: '16px',
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #ecf0f1'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '12px'
  },
  chartTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: '8px'
  },
  selectedPointInfo: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
    fontSize: '13px'
  },
  selectedPointRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px'
  },
  selectedPointLabel: {
    color: '#7f8c8d',
    fontWeight: '500'
  },
  selectedPointValue: {
    color: '#2C3E50',
    fontWeight: '600'
  },
  chartControls: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: '8px'
  },
  sensorTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  sensorTab: {
    padding: '6px 10px',
    borderRadius: '16px',
    border: '1px solid #bdc3c7',
    backgroundColor: 'white',
    fontSize: '12px',
    cursor: 'pointer'
  },
  sensorTabActive: {
    backgroundColor: '#2C3E50',
    color: 'white',
    borderColor: '#2C3E50'
  },
  rangeButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  rangeButton: {
    padding: '4px 10px',
    borderRadius: '16px',
    border: '1px solid #bdc3c7',
    backgroundColor: 'white',
    fontSize: '12px',
    cursor: 'pointer'
  },
  rangeButtonActive: {
    backgroundColor: '#2C3E50',
    color: 'white',
    borderColor: '#2C3E50'
  },
  chartBody: {
    height: '280px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  chartMessage: {
    fontSize: '14px',
    color: '#7f8c8d',
    textAlign: 'center'
  },
  chartErrorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '20px'
  },
  chartErrorMessage: {
    fontSize: '14px',
    color: '#e74c3c',
    textAlign: 'center',
    fontWeight: '500'
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  jsonSection: {
    marginBottom: '16px',
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #ecf0f1'
  },
  jsonHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s'
  },
  jsonTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#2C3E50'
  },
  toggleButton: {
    padding: '6px 12px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  jsonData: {
    marginTop: '12px',
    backgroundColor: '#f5f5f5',
    padding: '16px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    border: '1px solid #ddd'
  },
  qrSection: {
    marginBottom: '20px',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #ecf0f1',
    textAlign: 'center'
  },
  qrTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '8px'
  },
  qrDescription: {
    fontSize: '14px',
    color: '#7f8c8d',
    marginBottom: '16px'
  },
  qrContainer: {
    display: 'inline-block',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
  },
  qrActions: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'center'
  },
  qrDownloadButton: {
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#27AE60',
    color: 'white',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  }
};

export default Devices;
