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
  const [allDevices, setAllDevices] = useState([]); // All devices for counting
  const [devices, setDevices] = useState([]); // Filtered devices for display
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [filter, setFilter] = useState('all'); // all, online, offline
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const qrContainerRef = useRef(null);

  const [chartError, setChartError] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState('temperature');
  const [selectedRange, setSelectedRange] = useState(24); // hours

  useEffect(() => {
    fetchDevices();
  }, [filter]);

  // Helper function to check if device is online (based on lastSeenAt, like isOnline() method)
  const isDeviceOnline = (device) => {
    if (!device) return false;
    
    // First check status field
    if (device.status === 'online') return true;
    if (device.status === 'offline') return false;
    
    // If status is not set or unclear, check lastSeenAt (within last 5 minutes)
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
      
      // Store all devices for counting
      setAllDevices(allDevicesData);
      
      // Apply client-side filtering based on online status
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
      console.warn('Error formatting time label:', err);
      return '';
    }
  };

  const loadTelemetry = async (deviceId, hours = 24) => {
    if (!deviceId) return;
    try {
      setChartLoading(true);
      setChartError(null);
      setChartData([]);

      const response = await devicesService.getTelemetryHistory(deviceId, hours);
      
      if (!response || !response.success) {
        throw new Error(response?.message || 'Failed to fetch telemetry history');
      }
      
      let items = Array.isArray(response.data) ? response.data : [];
      
      // Filter items with valid timestamps (similar to mobile app)
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
      
      // Sort by timestamp
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
      
      // Process data similar to mobile app
      const processed = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const item = items[i];
          const payload = item?.payload || {};
          
          const timestamp = new Date(item?.createdAt || payload?.ts || Date.now());
          if (isNaN(timestamp.getTime())) continue;
          
          const timeLabel = formatTimeLabel(timestamp);
          if (!timeLabel) continue;
          
          // Process sensor values safely
          const temp = payload.temp;
          const humid = payload.humid;
          const gas = payload.gas_ppm;
          const smoke = payload.smoke;
          
          const processedItem = {
            time: timeLabel,
            timestamp: timestamp.getTime(),
          };
          
          // Only add valid numeric values
          if (temp !== null && temp !== undefined) {
            const numTemp = Number(temp);
            if (!isNaN(numTemp) && isFinite(numTemp)) {
              processedItem.temperature = numTemp;
            }
          }
          
          if (humid !== null && humid !== undefined) {
            const numHumid = Number(humid);
            if (!isNaN(numHumid) && isFinite(numHumid)) {
              processedItem.humidity = numHumid;
            }
          }
          
          if (gas !== null && gas !== undefined) {
            const numGas = Number(gas);
            if (!isNaN(numGas) && isFinite(numGas)) {
              processedItem.gas = numGas;
            }
          }
          
          if (smoke !== null && smoke !== undefined) {
            const numSmoke = Number(smoke);
            if (!isNaN(numSmoke) && isFinite(numSmoke)) {
              processedItem.smoke = numSmoke;
            }
          }
          
          processed.push(processedItem);
        } catch (err) {
          console.warn('Error processing data item:', err);
          continue; // Skip this item
        }
      }
      
      // Sort by timestamp again
      processed.sort((a, b) => a.timestamp - b.timestamp);
      
      setChartData(processed);
    } catch (error) {
      console.error('Error loading telemetry:', error);
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to load telemetry data';
      setChartError(errorMessage);
      setChartData([]);
    } finally {
      setChartLoading(false);
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
  }, [selectedDevice, selectedRange]);

  const handleDelete = async (deviceId, e) => {
    e.stopPropagation(); // Prevent card click
    if (!window.confirm(t('devices.deleteConfirm', { deviceId }))) {
      return;
    }

    try {
      await devicesService.deleteDevice(deviceId);
      alert(t('devices.deleteSuccess'));
      fetchDevices(); // Refresh list
      if (selectedDevice?.deviceId === deviceId) {
        setSelectedDevice(null); // Close modal if deleted device was selected
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
                      {device.latestTelemetry.smoke || 'N/A'} V
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
              <div style={styles.chartSection}>
                <div style={styles.chartHeader}>
                  <h3 style={styles.chartTitle}>{t('devices.chartTitle')}</h3>
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
                    <div style={styles.chartMessage}>{chartError}</div>
                  )}
                  {!chartLoading && !chartError && chartData.length === 0 && (
                    <div style={styles.chartMessage}>{t('devices.chartNoData')}</div>
                  )}
                  {!chartLoading && !chartError && chartData.length > 0 && (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData} margin={{ top: 10, left: 0, right: 16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        {selectedSensor === 'temperature' && (
                          <Line type="monotone" dataKey="temperature" stroke="#E74C3C" dot={false} />
                        )}
                        {selectedSensor === 'humidity' && (
                          <Line type="monotone" dataKey="humidity" stroke="#3498DB" dot={false} />
                        )}
                        {selectedSensor === 'gas' && (
                          <Line type="monotone" dataKey="gas" stroke="#F39C12" dot={false} />
                        )}
                        {selectedSensor === 'smoke' && (
                          <Line type="monotone" dataKey="smoke" stroke="#8E44AD" dot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {selectedDevice?.deviceId && (
                <div style={styles.qrSection}>
                  <h3 style={styles.qrTitle}>{t('deviceEditor.qrCode')}</h3>
                  {/* Reuse description from device editor translations */}
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

              <pre style={styles.jsonData}>
                {JSON.stringify(selectedDevice, null, 2)}
              </pre>
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
    color: '#2C3E50'
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
  jsonData: {
    backgroundColor: '#f5f5f5',
    padding: '16px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto'
  },
  qrSection: {
    marginBottom: '16px',
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
