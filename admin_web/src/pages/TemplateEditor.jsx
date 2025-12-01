import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import templatesService from '../services/templatesService';

function TemplateEditor() {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { templateKey } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!templateKey;
  const languageParam = searchParams.get('language') || currentLanguage;

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    templateKey: '',
    name: '',
    description: '',
    language: isEdit ? languageParam : currentLanguage, // Auto-set to current language when creating
    priority: 'medium',
    isActive: true,
    cooldownPeriod: 120000, // 2 minutes (default for medium)
    conditions: [{ type: 'sensor', sensor: 'temperature', operator: '>', value: '', unit: '°C' }],
    actions: [{ type: 'send_alert', message: '' }]
  });

  // Update language when currentLanguage changes (only when creating new)
  useEffect(() => {
    if (!isEdit) {
      setFormData(prev => ({ ...prev, language: currentLanguage }));
    }
  }, [currentLanguage, isEdit]);
  const [isTemplateKeyManuallyEdited, setIsTemplateKeyManuallyEdited] = useState(false);

  // Function to get cooldown period based on priority
  const getCooldownByPriority = (priority) => {
    const cooldownMap = {
      urgent: 30000,    // 30 seconds
      high: 60000,       // 1 minute
      medium: 120000,   // 2 minutes
      low: 180000       // 3 minutes
    };
    return cooldownMap[priority] || 120000; // Default to medium if not found
  };

  // Function to generate templateKey from name
  const generateTemplateKey = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-+/g, '_') // Replace hyphens with underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single underscore
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  };

  useEffect(() => {
    if (isEdit) {
      fetchTemplate();
    }
  }, [templateKey, languageParam]);

  // Auto-generate templateKey from name when creating new template
  useEffect(() => {
    if (!isEdit && !isTemplateKeyManuallyEdited) {
      const generatedKey = generateTemplateKey(formData.name);
      setFormData(prev => ({ ...prev, templateKey: generatedKey }));
    }
  }, [formData.name, isEdit, isTemplateKeyManuallyEdited]);

  const fetchTemplate = async () => {
    try {
      const response = await templatesService.getTemplateByKey(templateKey, languageParam);
      const template = response.data;
      setFormData({
        templateKey: template.templateKey || '',
        name: template.name || '',
        description: template.description || '',
        language: template.language || 'vi',
        priority: template.priority || 'medium',
        isActive: template.isActive !== undefined ? template.isActive : true,
        cooldownPeriod: template.cooldownPeriod || 300000,
        conditions: template.conditions || [{ type: 'sensor', sensor: 'temperature', operator: '>', value: '', unit: '°C' }],
        actions: template.actions || [{ type: 'send_alert', message: '' }]
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      alert(t('templateEditor.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous error
    
    // Auto-generate templateKey if not provided when creating new template
    let finalFormData = { ...formData };
    if (!isEdit && !finalFormData.templateKey && finalFormData.name) {
      finalFormData.templateKey = generateTemplateKey(finalFormData.name);
    }
    
    // Validate
    if (!finalFormData.templateKey || !finalFormData.name || !finalFormData.conditions.length || !finalFormData.actions.length) {
      setError(t('templateEditor.validation.required'));
      return;
    }

    // Validate conditions
    for (const condition of formData.conditions) {
      if (!condition.sensor || !condition.operator || condition.value === '') {
        setError(t('templateEditor.validation.conditionsRequired'));
        return;
      }
    }

    // Validate actions
    for (const action of formData.actions) {
      if (!action.type || !action.message) {
        setError(t('templateEditor.validation.actionsRequired'));
        return;
      }
    }

    try {
      if (isEdit) {
        await templatesService.updateTemplate(templateKey, finalFormData.language, finalFormData);
        alert(t('templateEditor.updateSuccess'));
      } else {
        await templatesService.createTemplate(finalFormData);
        alert(t('templateEditor.createSuccess'));
      }
      navigate('/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      // Format server error message
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      if (errorMsg.includes('status code')) {
        const statusMatch = errorMsg.match(/status code (\d+)/);
        if (statusMatch) {
          const statusCode = statusMatch[1];
          if (statusCode === '504') {
            setError(t('templateEditor.serverTimeout'));
          } else if (statusCode === '500') {
            setError(t('templateEditor.serverError'));
          } else if (statusCode === '400') {
            setError(t('templateEditor.invalidData'));
          } else {
            setError(`${t('templateEditor.connectionError')} (${statusCode})`);
          }
        } else {
          setError(errorMsg.replace(/^Request failed with /, ''));
        }
      } else if (errorMsg.includes('already exists') || errorMsg.includes('đã tồn tại')) {
        setError(t('templateEditor.templateExists'));
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
    return <div style={styles.loading}>{t('templateEditor.loading')}</div>;
  }

  return (
    <div style={styles.pageWrapper}>
      <h1 style={styles.title}>{isEdit ? t('templateEditor.editTitle') : t('templateEditor.createTitle')}</h1>

      <div style={styles.editorShell}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formSection}>
          <h2 style={styles.sectionTitle}>{t('templateEditor.basicInfo', { defaultValue: 'Basic Information' })}</h2>
          
          <div style={styles.formRow}>
            {isEdit && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('templateEditor.templateKey')}</label>
                  <input
                    type="text"
                    value={formData.templateKey}
                    onChange={(e) => {
                      setIsTemplateKeyManuallyEdited(true);
                      setFormData({ ...formData, templateKey: e.target.value });
                    }}
                    required
                    disabled={isEdit}
                    style={{...styles.input, ...(isEdit ? styles.disabledInput : {})}}
                    placeholder="e.g., temp_emergency"
                  />
                  <small style={styles.helpText}>{t('templateEditor.keyHint')}</small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('templateEditor.language')}</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    required
                    disabled={isEdit}
                    style={{...styles.select, ...(isEdit ? styles.disabledInput : {})}}
                  >
                    <option value="vi">{t('templates.vietnamese')}</option>
                    <option value="en">{t('templates.english')}</option>
                  </select>
                  <small style={styles.helpText}>{t('templateEditor.languageHint')}</small>
                </div>
              </>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('templateEditor.name')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={styles.input}
              placeholder="e.g., Emergency Temperature Alert"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('templateEditor.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={styles.textarea}
              rows="2"
              placeholder={t('templateEditor.description', { defaultValue: 'Description about this template...' })}
            />
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('templateEditor.priority')}</label>
              <select
                value={formData.priority}
                onChange={(e) => {
                  const newPriority = e.target.value;
                  const newCooldown = getCooldownByPriority(newPriority);
                  setFormData({ ...formData, priority: newPriority, cooldownPeriod: newCooldown });
                }}
                style={styles.select}
              >
                <option value="low">{t('templateEditor.priorities.low')}</option>
                <option value="medium">{t('templateEditor.priorities.medium')}</option>
                <option value="high">{t('templateEditor.priorities.high')}</option>
                <option value="urgent">{t('templateEditor.priorities.urgent')}</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('templateEditor.cooldown')}</label>
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
              {t('templateEditor.isActive')}
            </label>
          </div>
        </div>

        <div style={styles.formSection}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>{t('templateEditor.conditions')}</h2>
            <button type="button" onClick={addCondition} style={styles.addButton}>
              {t('templateEditor.addCondition')}
            </button>
          </div>

          {formData.conditions.map((condition, index) => (
            <div key={index} style={styles.conditionCard}>
              <div style={styles.conditionHeader}>
                <h3 style={styles.conditionTitle}>{t('templateEditor.conditions')} {index + 1}</h3>
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
                  <label style={styles.label}>{t('templateEditor.sensor')}</label>
                  <select
                    value={condition.sensor}
                    onChange={(e) => {
                      const newSensor = e.target.value;
                      const newUnit = getSensorUnit(newSensor);
                      // Update sensor, unit, and clear value when sensor changes
                      const newConditions = [...formData.conditions];
                      newConditions[index] = {
                        ...newConditions[index],
                        sensor: newSensor,
                        unit: newUnit,
                        value: '' // Clear value when sensor changes
                      };
                      setFormData({ ...formData, conditions: newConditions });
                    }}
                    style={styles.select}
                  >
                    <option value="temperature">{t('templateEditor.sensors.temperature')}</option>
                    <option value="humidity">{t('templateEditor.sensors.humidity')}</option>
                    <option value="gas_ppm">{t('templateEditor.sensors.gas_ppm')}</option>
                    <option value="smoke">{t('templateEditor.sensors.smoke')}</option>
                    <option value="flame">{t('templateEditor.sensors.flame')}</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('templateEditor.operator')}</label>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                    style={styles.select}
                  >
                    <option value=">">{t('templateEditor.operators.>')}</option>
                    <option value="<">{t('templateEditor.operators.<')}</option>
                    <option value=">=">{t('templateEditor.operators.>=')}</option>
                    <option value="<=">{t('templateEditor.operators.<=')}</option>
                    <option value="==">{t('templateEditor.operators.==')}</option>
                    <option value="!=">{t('templateEditor.operators.!=')}</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>{t('templateEditor.value')}</label>
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
                  <label style={styles.label}>{t('templateEditor.unit')}</label>
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
            <h2 style={styles.sectionTitle}>{t('templateEditor.actions')}</h2>
            <button type="button" onClick={addAction} style={styles.addButton}>
              {t('templateEditor.addAction')}
            </button>
          </div>

          {formData.actions.map((action, index) => (
            <div key={index} style={styles.actionCard}>
              <div style={styles.conditionHeader}>
                <h3 style={styles.conditionTitle}>{t('templateEditor.actions')} {index + 1}</h3>
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
                  <label style={styles.label}>{t('templateEditor.actionType')}</label>
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(index, 'type', e.target.value)}
                    style={styles.select}
                  >
                    <option value="send_alert">{t('templateEditor.actionTypes.send_alert')}</option>
                    <option value="send_notification">{t('templateEditor.actionTypes.send_notification')}</option>
                  </select>
                </div>

                <div style={{...styles.formGroup, gridColumn: 'span 3'}}>
                  <label style={styles.label}>{t('templateEditor.message')}</label>
                  <input
                    type="text"
                    value={action.message || ''}
                    onChange={(e) => updateAction(index, 'message', e.target.value)}
                    style={styles.input}
                    required
                    placeholder={t('templateEditor.message', { defaultValue: 'Alert/notification content' })}
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
          <button type="button" onClick={() => navigate('/templates')} style={styles.cancelButton}>
            {t('templateEditor.cancel')}
          </button>
          <button type="submit" style={styles.submitButton}>
            {isEdit ? t('templateEditor.update') : t('templateEditor.create')}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

const styles = {
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '20px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  pageWrapper: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '10px 20px 30px'
  },
  editorShell: {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e9f0',
    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
    padding: '20px 24px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formSection: {
    marginBottom: '28px',
    paddingBottom: '24px',
    borderBottom: '1px solid #f0f2f5'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2a37',
    marginBottom: '10px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px'
  },
  formGroup: {
    marginBottom: '14px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    cursor: 'not-allowed'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: 'white',
    boxSizing: 'border-box'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
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
    backgroundColor: '#fbfcff',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #edf1fb',
    marginBottom: '10px'
  },
  conditionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  conditionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2a37',
    margin: 0
  },
  conditionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px'
  },
  actionCard: {
    backgroundColor: '#fbfcff',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #edf1fb',
    marginBottom: '10px'
  },
  addButton: {
    padding: '6px 12px',
    backgroundColor: '#27AE60',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500'
  },
  removeButton: {
    padding: '4px 8px',
    backgroundColor: '#E74C3C',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
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
    gap: '10px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f0f2f5'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#95A5A6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#2C3E50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};

export default TemplateEditor;
