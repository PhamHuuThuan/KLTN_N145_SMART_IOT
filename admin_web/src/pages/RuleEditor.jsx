import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import rulesService from '../services/rulesService';
import devicesService from '../services/devicesService';

function RuleEditor() {
  const { t } = useTranslation();
  const { ruleId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!ruleId;

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deviceId: '',
    createdBy: '',
    priority: 'medium',
    isActive: true,
    cooldownPeriod: 300000,
    conditions: [{ type: 'sensor', sensor: 'temperature', operator: '>', value: '', unit: '°C' }],
    actions: [{ type: 'send_alert', message: '' }]
  });

  useEffect(() => {
    fetchDevices();
    if (isEdit) {
      fetchRule();
    }
  }, [ruleId]);

  const fetchDevices = async () => {
    try {
      const response = await devicesService.getAllDevices({ limit: 1000 });
      setDevices(response.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchRule = async () => {
    try {
      const response = await rulesService.getRuleById(ruleId);
      const rule = response.data;
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        deviceId: rule.deviceId || '',
        createdBy: rule.createdBy || '',
        priority: rule.priority || 'medium',
        isActive: rule.isActive !== undefined ? rule.isActive : true,
        cooldownPeriod: rule.cooldownPeriod || 300000,
        conditions: rule.conditions || [{ type: 'sensor', sensor: 'temperature', operator: '>', value: '', unit: '°C' }],
        actions: rule.actions || [{ type: 'send_alert', message: '' }]
      });
    } catch (error) {
      console.error('Error fetching rule:', error);
      alert(t('ruleEditor.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous error
    
    // Validate
    if (!formData.name || !formData.deviceId || !formData.conditions.length || !formData.actions.length) {
      setError(t('ruleEditor.validation.required'));
      return;
    }

    // Validate conditions
    for (const condition of formData.conditions) {
      if (!condition.sensor || !condition.operator || condition.value === '') {
        setError(t('ruleEditor.validation.conditionsRequired'));
        return;
      }
    }

    try {
      if (isEdit) {
        await rulesService.updateRule(ruleId, formData);
        alert(t('ruleEditor.saveSuccess'));
      } else {
        await rulesService.createRule(formData);
        alert(t('ruleEditor.createSuccess'));
      }
      navigate('/rules');
    } catch (error) {
      console.error('Error saving rule:', error);
      // Format server error message
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      if (errorMsg.includes('status code')) {
        const statusMatch = errorMsg.match(/status code (\d+)/);
        if (statusMatch) {
          const statusCode = statusMatch[1];
          if (statusCode === '504') {
            setError(t('ruleEditor.serverTimeout'));
          } else if (statusCode === '500') {
            setError(t('ruleEditor.serverError'));
          } else if (statusCode === '400') {
            setError(t('ruleEditor.invalidData'));
          } else {
            setError(`${t('ruleEditor.connectionError')} (${statusCode})`);
          }
        } else {
          setError(errorMsg.replace(/^Request failed with /, ''));
        }
      } else {
        setError(errorMsg);
      }
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { type: 'sensor', sensor: 'temperature', operator: '>', value: '', unit: '°C' }]
    });
  };

  const removeCondition = (index) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index)
    });
  };

  const updateCondition = (index, field, value) => {
    const newConditions = [...formData.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setFormData({ ...formData, conditions: newConditions });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'send_alert', message: '' }]
    });
  };

  const removeAction = (index) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    });
  };

  const updateAction = (index, field, value) => {
    const newActions = [...formData.actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setFormData({ ...formData, actions: newActions });
  };

  const getSensorUnit = (sensor) => {
    const units = {
      temperature: '°C',
      humidity: '%',
      gas_ppm: 'ppm',
      smoke: 'ppm',
      flame: ''
    };
    return units[sensor] || '';
  };

  if (loading) {
    return <div style={styles.loading}>{t('ruleEditor.loading')}</div>;
  }

  return (
    <div>
      <h1 style={styles.title}>{isEdit ? t('ruleEditor.editTitle') : t('ruleEditor.createTitle')}</h1>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formSection}>
          <h2 style={styles.sectionTitle}>{t('ruleEditor.basicInfo', { defaultValue: 'Basic Information' })}</h2>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>{t('ruleEditor.name')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={styles.input}
              placeholder="e.g., High Temperature Alert"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('ruleEditor.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={styles.textarea}
              rows="3"
              placeholder="Mô tả về quy tắc này..."
            />
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('ruleEditor.device')}</label>
              <select
                value={formData.deviceId}
                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                required
                style={styles.select}
              >
                <option value="">{t('ruleEditor.selectDevice')}</option>
                {devices.map(device => (
                  <option key={device._id} value={device.deviceId}>
                    {device.name} ({device.deviceId})
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('ruleEditor.owner')}</label>
              <input
                type="text"
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                style={styles.input}
                placeholder={t('ruleEditor.ownerHint')}
              />
            </div>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('ruleEditor.priority')}</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                style={styles.select}
              >
                <option value="low">{t('ruleEditor.priorities.low')}</option>
                <option value="medium">{t('ruleEditor.priorities.medium')}</option>
                <option value="high">{t('ruleEditor.priorities.high')}</option>
                <option value="urgent">{t('ruleEditor.priorities.urgent')}</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('ruleEditor.cooldown')}</label>
              <input
                type="number"
                value={formData.cooldownPeriod}
                onChange={(e) => setFormData({ ...formData, cooldownPeriod: parseInt(e.target.value) || 0 })}
                style={styles.input}
                min="0"
                max="86400000"
              />
              <small style={styles.helpText}>
                {formData.cooldownPeriod >= 60000 
                  ? `${Math.floor(formData.cooldownPeriod / 1000 / 60)} ${t('templates.minutes')}`
                  : `${Math.floor(formData.cooldownPeriod / 1000)} ${t('templates.seconds')}`
                }
              </small>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                style={styles.checkbox}
              />
              {t('ruleEditor.isActive', { defaultValue: 'Activate immediately' })}
            </label>
          </div>
        </div>

        <div style={styles.formSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{t('ruleEditor.conditions')}</h2>
            <button type="button" onClick={addCondition} style={styles.addButton}>
              {t('ruleEditor.addCondition')}
            </button>
          </div>

          {formData.conditions.map((condition, index) => (
            <div key={index} style={styles.conditionCard}>
              <div style={styles.conditionHeader}>
                <h3 style={styles.conditionTitle}>Điều kiện {index + 1}</h3>
                {formData.conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    style={styles.removeButton}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={styles.conditionGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('ruleEditor.sensor')}</label>
                  <select
                    value={condition.sensor}
                    onChange={(e) => {
                      updateCondition(index, 'sensor', e.target.value);
                      updateCondition(index, 'unit', getSensorUnit(e.target.value));
                    }}
                    style={styles.select}
                  >
                    <option value="temperature">{t('ruleEditor.sensors.temperature')}</option>
                    <option value="humidity">{t('ruleEditor.sensors.humidity')}</option>
                    <option value="gas_ppm">{t('ruleEditor.sensors.gas_ppm')}</option>
                    <option value="smoke">{t('ruleEditor.sensors.smoke')}</option>
                    <option value="flame">{t('ruleEditor.sensors.flame')}</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('ruleEditor.operator')}</label>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                    style={styles.select}
                  >
                    <option value=">">{t('ruleEditor.operators.>')}</option>
                    <option value="<">{t('ruleEditor.operators.<')}</option>
                    <option value=">=">{t('ruleEditor.operators.>=')}</option>
                    <option value="<=">{t('ruleEditor.operators.<=')}</option>
                    <option value="==">{t('ruleEditor.operators.==')}</option>
                    <option value="!=">{t('ruleEditor.operators.!=')}</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('ruleEditor.value')}</label>
                  <input
                    type="number"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, 'value', parseFloat(e.target.value) || '')}
                    style={styles.input}
                    required
                    step="0.1"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('ruleEditor.unit')}</label>
                  <input
                    type="text"
                    value={condition.unit || ''}
                    onChange={(e) => updateCondition(index, 'unit', e.target.value)}
                    style={styles.input}
                    placeholder="°C, %, ppm..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.formSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{t('ruleEditor.actions')}</h2>
            <button type="button" onClick={addAction} style={styles.addButton}>
              {t('ruleEditor.addAction')}
            </button>
          </div>

          {formData.actions.map((action, index) => (
            <div key={index} style={styles.actionCard}>
              <div style={styles.conditionHeader}>
                <h3 style={styles.conditionTitle}>{t('ruleEditor.actions')} {index + 1}</h3>
                {formData.actions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAction(index)}
                    style={styles.removeButton}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={styles.conditionGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('ruleEditor.actionType')}</label>
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(index, 'type', e.target.value)}
                    style={styles.select}
                  >
                    <option value="send_alert">{t('ruleEditor.actionTypes.send_alert')}</option>
                    <option value="send_notification">{t('ruleEditor.actionTypes.send_notification')}</option>
                  </select>
                </div>

                <div style={{...styles.formGroup, gridColumn: 'span 3'}}>
                  <label style={styles.label}>{t('ruleEditor.message')}</label>
                  <input
                    type="text"
                    value={action.message || ''}
                    onChange={(e) => updateAction(index, 'message', e.target.value)}
                    style={styles.input}
                    placeholder={t('ruleEditor.message', { defaultValue: 'Alert/notification content' })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={styles.errorMessage}>
            {error}
          </div>
        )}

        <div style={styles.formActions}>
          <button type="button" onClick={() => navigate('/rules')} style={styles.cancelButton}>
            {t('ruleEditor.cancel')}
          </button>
          <button type="submit" style={styles.submitButton}>
            {isEdit ? t('ruleEditor.update') : t('ruleEditor.create')}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '30px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  form: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  formSection: {
    marginBottom: '40px',
    paddingBottom: '30px',
    borderBottom: '1px solid #eee'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '20px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical'
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '16px',
    outline: 'none',
    backgroundColor: 'white'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  helpText: {
    display: 'block',
    marginTop: '4px',
    fontSize: '12px',
    color: '#7f8c8d'
  },
  conditionCard: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  conditionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  conditionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2C3E50',
    margin: 0
  },
  conditionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px'
  },
  actionCard: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#27AE60',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  removeButton: {
    padding: '4px 8px',
    backgroundColor: '#E74C3C',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  errorMessage: {
    padding: '12px 16px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '16px',
    border: '1px solid #fcc'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '30px',
    paddingTop: '30px',
    borderTop: '1px solid #eee'
  },
  cancelButton: {
    padding: '12px 24px',
    backgroundColor: '#95A5A6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500'
  },
  submitButton: {
    padding: '12px 24px',
    backgroundColor: '#2C3E50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500'
  }
};

export default RuleEditor;
