import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import devicesService from '../services/devicesService';

function DeviceEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    deviceId: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdDevice, setCreatedDevice] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [existingDevices, setExistingDevices] = useState([]);

  useEffect(() => {
    // Fetch all devices to check for duplicates
    const fetchDevices = async () => {
      try {
        const response = await devicesService.getAllDevices({ limit: 1000 });
        setExistingDevices(response.data || []);
      } catch (error) {
        console.error('Error fetching devices:', error);
      }
    };
    fetchDevices();
  }, []);

  const generateDeviceId = () => {
    // Generate a unique device ID: KITCHEN-ESP32-XXXX
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `KITCHEN-ESP32-${random}`;
  };

  const handleGenerateId = () => {
    setFormData({ ...formData, deviceId: generateDeviceId() });
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `QR-${formData.deviceId || createdDevice?.deviceId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateQRCodeImage = () => {
    const container = document.getElementById('qrcode-canvas');
    if (!container) return;
    
    const svg = container.querySelector('svg');
    if (!svg) return;
    
    try {
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
        setQrCodeUrl(pngUrl);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback: try direct SVG to canvas conversion
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          const img2 = new Image();
          img2.onload = () => {
            ctx.drawImage(img2, 0, 0);
            setQrCodeUrl(canvas.toDataURL('image/png'));
          };
          img2.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }, 100);
      };
      img.src = url;
    } catch (error) {
      console.error('Error generating QR code image:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.deviceId.trim()) {
      setError('Vui lòng nhập Device ID');
      setLoading(false);
      return;
    }

    // Check if deviceId already exists
    const trimmedDeviceId = formData.deviceId.trim();
    const existingDevice = existingDevices.find(
      device => device.deviceId && device.deviceId.toUpperCase() === trimmedDeviceId.toUpperCase()
    );

    if (existingDevice) {
      setError(t('deviceEditor.deviceIdExists'));
      setLoading(false);
      return;
    }

    try {
      // Lấy ownerId từ device đầu tiên có ownerId trong danh sách
      const deviceWithOwner = existingDevices.find(device => device.ownerId);
      const ownerId = deviceWithOwner?.ownerId || null;
      
      const payload = {
        deviceId: trimmedDeviceId,
        name: (formData.name || trimmedDeviceId).trim()
      };
      
      // Thêm ownerId nếu tìm thấy
      if (ownerId) {
        payload.ownerId = ownerId;
      }

      const response = await devicesService.createDevice(payload);
      
      if (response.success) {
        setCreatedDevice(response.data);
        // Generate QR code image after a short delay to ensure SVG is rendered
        setTimeout(() => {
          generateQRCodeImage();
        }, 1000);
      } else {
        setError(response.message || t('deviceEditor.createError'));
      }
    } catch (err) {
      console.error('Error creating device:', err);
      // Format server error message
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      if (errorMsg.includes('already exists') || errorMsg.includes('đã tồn tại')) {
        setError(t('deviceEditor.deviceIdExists'));
      } else if (errorMsg.includes('status code')) {
        const statusMatch = errorMsg.match(/status code (\d+)/);
        if (statusMatch) {
          const statusCode = statusMatch[1];
          if (statusCode === '504') {
            setError(t('deviceEditor.serverTimeout'));
          } else if (statusCode === '500') {
            setError(t('deviceEditor.serverError'));
          } else if (statusCode === '400') {
            setError(t('deviceEditor.invalidData'));
          } else {
            setError(`${t('deviceEditor.connectionError')} (${statusCode})`);
          }
        } else {
          setError(errorMsg.replace(/^Request failed with /, ''));
        }
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigate('/devices');
  };

  const qrValue = createdDevice?.deviceId || formData.deviceId || '';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{t('deviceEditor.createTitle')}</h1>

      {createdDevice ? (
        <div style={styles.successCard}>
          <div style={styles.successHeader}>
            <h2 style={styles.successTitle}>{t('deviceEditor.createSuccess')}</h2>
            <button onClick={handleClose} style={styles.closeButton}>✕</button>
          </div>
          
          <div style={styles.deviceInfo}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>{t('deviceEditor.deviceId')}:</span>
              <span style={styles.infoValue}>{createdDevice.deviceId}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>{t('deviceEditor.name')}:</span>
              <span style={styles.infoValue}>{createdDevice.name}</span>
            </div>
          </div>

          <div style={styles.qrSection}>
            <h3 style={styles.qrTitle}>{t('deviceEditor.qrCode')}</h3>
            <p style={styles.qrDescription}>{t('deviceEditor.qrDescription')}</p>
            
            <div style={styles.qrContainer} id="qrcode-canvas">
              <QRCodeSVG
                value={qrValue}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            <div style={styles.qrActions}>
              <button onClick={downloadQRCode} style={styles.downloadButton} disabled={!qrCodeUrl}>
                {t('deviceEditor.downloadQR')}
              </button>
              <button onClick={handleClose} style={styles.backButton}>
                {t('deviceEditor.backToDevices')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.error}>{error}</div>
          )}

          <div style={styles.formSection}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                {t('deviceEditor.deviceId')} *
              </label>
              <div style={styles.inputGroup}>
                <input
                  type="text"
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value.toUpperCase() })}
                  required
                  style={styles.input}
                  placeholder="KITCHEN-ESP32-XXXX"
                  pattern="[A-Z0-9-]+"
                />
                <button
                  type="button"
                  onClick={handleGenerateId}
                  style={styles.generateButton}
                >
                  {t('deviceEditor.generateId')}
                </button>
              </div>
              <small style={styles.helpText}>{t('deviceEditor.deviceIdHint')}</small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                {t('deviceEditor.name')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={styles.input}
                placeholder={t('deviceEditor.namePlaceholder')}
              />
              <small style={styles.helpText}>{t('deviceEditor.nameHint')}</small>
            </div>
          </div>

          <div style={styles.formActions}>
            <button type="button" onClick={handleClose} style={styles.cancelButton}>
              {t('deviceEditor.cancel')}
            </button>
            <button type="submit" style={styles.submitButton} disabled={loading}>
              {loading ? t('deviceEditor.creating') : t('deviceEditor.create')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '30px',
    width: '100%',
    textAlign: 'center'
  },
  form: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    width: '100%',
    margin: '0 auto'
  },
  formSection: {
    marginBottom: '24px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#34495e',
    marginBottom: '8px'
  },
  inputGroup: {
    display: 'flex',
    gap: '10px'
  },
  input: {
    flex: 1,
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  generateButton: {
    padding: '12px 20px',
    backgroundColor: '#3498DB',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.2s'
  },
  helpText: {
    display: 'block',
    fontSize: '12px',
    color: '#7f8c8d',
    marginTop: '4px'
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  cancelButton: {
    padding: '12px 24px',
    backgroundColor: '#95A5A6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  submitButton: {
    padding: '12px 24px',
    backgroundColor: '#2C3E50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  successCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxWidth: '600px',
    width: '100%',
    margin: '0 auto'
  },
  successHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#27AE60',
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#7f8c8d',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  deviceInfo: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '14px'
  },
  infoLabel: {
    color: '#7f8c8d',
    fontWeight: '500'
  },
  infoValue: {
    color: '#2C3E50',
    fontWeight: '600'
  },
  qrSection: {
    textAlign: 'center',
    padding: '24px',
    borderTop: '1px solid #eee'
  },
  qrTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '8px'
  },
  qrDescription: {
    fontSize: '14px',
    color: '#7f8c8d',
    marginBottom: '20px'
  },
  qrContainer: {
    display: 'inline-block',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  qrActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  downloadButton: {
    padding: '12px 24px',
    backgroundColor: '#27AE60',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  backButton: {
    padding: '12px 24px',
    backgroundColor: '#2C3E50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  }
};

export default DeviceEditor;

