import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import rulesService from '../services/rulesService';
import devicesService from '../services/devicesService';
import templatesService from '../services/templatesService';

function Rules() {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [deviceFilter, setDeviceFilter] = useState('');
  const [devices, setDevices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedDeviceForCreate, setSelectedDeviceForCreate] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);

  useEffect(() => {
    fetchDevices();
    fetchRules();
  }, [filter, deviceFilter]);

  useEffect(() => {
    if (!selectedTemplateKey) {
      setSelectedTemplate(null);
      return;
    }
    const [key, language] = selectedTemplateKey.split('::');
    const template = templates.find(
      (tpl) => tpl.templateKey === key && tpl.language === language
    );
    setSelectedTemplate(template || null);
  }, [selectedTemplateKey, templates]);

  const fetchDevices = async () => {
    try {
      const response = await devicesService.getAllDevices({ limit: 1000 });
      setDevices(response.data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const params = { limit: 1000 };
      if (filter === 'active') params.isActive = 'true';
      if (filter === 'inactive') params.isActive = 'false';
      if (deviceFilter) params.deviceId = deviceFilter;
      
      const response = await rulesService.getAllRules(params);
      setRules(response.data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplatesList = async () => {
    try {
      setTemplatesLoading(true);
      const response = await templatesService.getAllTemplates({
        isActive: 'true',
        limit: 1000
      });
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    if (!templates.length) {
      fetchTemplatesList();
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedTemplateKey('');
    setSelectedTemplate(null);
    setSelectedDeviceForCreate('');
  };

  const handleCreateRuleFromTemplate = async () => {
    if (!selectedTemplate) {
      alert(t('rules.selectTemplate'));
      return;
    }
    if (!selectedDeviceForCreate) {
      alert(t('rules.selectDeviceModal'));
      return;
    }
    try {
      setCreatingRule(true);
      const targetDevice = devices.find((d) => d.deviceId === selectedDeviceForCreate);
      const payload = {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        deviceId: selectedDeviceForCreate,
        priority: selectedTemplate.priority,
        conditions: selectedTemplate.conditions,
        actions: selectedTemplate.actions,
        cooldownPeriod: selectedTemplate.cooldownPeriod,
        isActive: selectedTemplate.isActive !== undefined ? selectedTemplate.isActive : true
      };
      if (targetDevice?.ownerId) {
        payload.createdBy = targetDevice.ownerId;
      }
      await rulesService.createRule(payload);
      alert(t('rules.createSuccess'));
      closeCreateModal();
      fetchRules();
    } catch (error) {
      console.error('Error creating rule from template:', error);
      alert(t('rules.createError'));
    } finally {
      setCreatingRule(false);
    }
  };

  const handleToggleStatus = async (ruleId, currentStatus) => {
    try {
      await rulesService.toggleRuleStatus(ruleId, !currentStatus);
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule status:', error);
      alert(t('rules.toggleError'));
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm(t('rules.deleteConfirm'))) {
      return;
    }
    
    try {
      await rulesService.deleteRule(ruleId);
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert(t('rules.deleteError'));
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#E74C3C';
      case 'high': return '#F39C12';
      case 'medium': return '#3498DB';
      case 'low': return '#95A5A6';
      default: return '#95A5A6';
    }
  };

  const formatCondition = (condition) => {
    const sensor = t(`rules.sensor.${condition.sensor}`, { defaultValue: condition.sensor });
    const operator = t(`rules.operator.${condition.operator}`, { defaultValue: condition.operator });
    const unit = condition.unit || '';
    
    return `${sensor} ${operator} ${condition.value}${unit}`;
  };

  if (loading) {
    return <div style={styles.loading}>{t('common.loading')}</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('rules.title')}</h1>
        <button type="button" onClick={openCreateModal} style={styles.createButton}>
          {t('rules.createRule')}
        </button>
      </div>

      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t('rules.filterStatus')}</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">{t('common.all')} ({rules.length})</option>
            <option value="active">{t('common.active')} ({rules.filter(r => r.isActive).length})</option>
            <option value="inactive">{t('common.inactive')} ({rules.filter(r => !r.isActive).length})</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t('rules.filterDevice')}</label>
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">{t('rules.allDevices')}</option>
            {devices.map(device => (
              <option key={device._id} value={device.deviceId}>
                {device.name} ({device.deviceId})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.rulesGrid}>
        {rules.map(rule => (
          <div key={rule._id} style={styles.ruleCard}>
            <div style={styles.ruleHeader}>
              <div>
                <h3 style={styles.ruleName}>{rule.name}</h3>
                <span
                  style={{
                    ...styles.priorityBadge,
                    backgroundColor: getPriorityColor(rule.priority)
                  }}
                >
                  {rule.priority}
                </span>
              </div>
              <div style={styles.ruleStatus}>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: rule.isActive ? '#27AE60' : '#95A5A6'
                  }}
                >
                  {rule.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>

            {rule.description && (
              <p style={styles.ruleDescription}>{rule.description}</p>
            )}

            <div style={styles.ruleInfo}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('rules.deviceId')}:</span>
                <span style={styles.infoValue}>{rule.deviceId}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('rules.createdBy')}:</span>
                <span style={styles.infoValue}>{rule.createdBy}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('rules.triggerCount')}:</span>
                <span style={styles.infoValue}>{rule.triggerCount || 0}</span>
              </div>
            </div>

            <div style={styles.conditions}>
              <h4 style={styles.sectionTitle}>{t('rules.conditions')}</h4>
              {rule.conditions?.map((condition, idx) => (
                <div key={idx} style={styles.conditionItem}>
                  {formatCondition(condition)}
                </div>
              ))}
            </div>

            <div style={styles.actions}>
              <Link
                to={`/rules/${rule._id}/edit`}
                style={styles.actionButton}
              >
                {t('rules.edit')}
              </Link>
              <button
                onClick={() => handleToggleStatus(rule._id, rule.isActive)}
                style={{
                  ...styles.actionButton,
                  backgroundColor: rule.isActive ? '#F39C12' : '#27AE60'
                }}
              >
                {rule.isActive ? t('rules.pause') : t('rules.activate')}
              </button>
              <button
                onClick={() => handleDelete(rule._id)}
                style={{
                  ...styles.actionButton,
                  backgroundColor: '#E74C3C'
                }}
              >
                {t('rules.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {rules.length === 0 && (
        <div style={styles.emptyState}>
          <p>{t('rules.noRules')}</p>
        </div>
      )}

      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={closeCreateModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>{t('rules.createFromTemplate')}</h2>
              <button style={styles.closeButton} onClick={closeCreateModal}>✕</button>
            </div>

            <div style={styles.modalBody}>
              {templatesLoading && (
                <div style={styles.modalNotice}>{t('common.loading')}</div>
              )}

              {!templatesLoading && templates.length === 0 && (
                <div style={styles.modalNotice}>{t('rules.noActiveTemplates')}</div>
              )}

              {templates.length > 0 && (
                <>
                  <div style={styles.modalField}>
                    <label style={styles.modalLabel}>{t('rules.selectTemplate')}</label>
                    <select
                      value={selectedTemplateKey}
                      onChange={(e) => setSelectedTemplateKey(e.target.value)}
                      style={styles.modalSelect}
                    >
                      <option value="">{t('rules.selectTemplatePlaceholder')}</option>
                      {templates.map((template) => (
                        <option
                          key={`${template.templateKey}-${template.language}`}
                          value={`${template.templateKey}::${template.language}`}
                        >
                          {template.name} ({template.language.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.modalField}>
                    <label style={styles.modalLabel}>{t('rules.selectDeviceModal')}</label>
                    <select
                      value={selectedDeviceForCreate}
                      onChange={(e) => setSelectedDeviceForCreate(e.target.value)}
                      style={styles.modalSelect}
                    >
                      <option value="">{t('rules.selectDevicePlaceholder')}</option>
                      {devices.map((device) => (
                        <option key={device._id} value={device.deviceId}>
                          {device.name} ({device.deviceId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div style={styles.templatePreview}>
                      <h3 style={styles.previewTitle}>{t('rules.templateDetails')}</h3>
                      {selectedTemplate.description && (
                        <p style={styles.previewDescription}>{selectedTemplate.description}</p>
                      )}
                      <div>
                        <h4 style={styles.previewSubtitle}>{t('rules.templateConditions')}</h4>
                        {selectedTemplate.conditions?.map((condition, idx) => (
                          <div key={idx} style={styles.previewItem}>
                            {formatCondition(condition)}
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 style={styles.previewSubtitle}>{t('rules.templateActions')}</h4>
                        {selectedTemplate.actions?.map((action, idx) => (
                          <div key={idx} style={styles.previewItem}>
                            {action.type} - {action.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={closeCreateModal}
                style={{ ...styles.modalButton, ...styles.modalCancel }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateRuleFromTemplate}
                style={{ ...styles.modalButton, ...styles.modalPrimary }}
                disabled={!selectedTemplate || !selectedDeviceForCreate || creatingRule}
              >
                {creatingRule ? t('common.processing') : t('rules.createRuleConfirm')}
              </button>
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
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2C3E50'
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#2C3E50',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  filters: {
    display: 'flex',
    gap: '20px',
    marginBottom: '30px',
    flexWrap: 'wrap'
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#2C3E50'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    minWidth: '200px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  rulesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px'
  },
  ruleCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  ruleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  ruleName: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2C3E50',
    margin: 0,
    marginBottom: '8px'
  },
  priorityBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500',
    textTransform: 'uppercase',
    display: 'inline-block'
  },
  ruleStatus: {
    display: 'flex',
    gap: '8px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500'
  },
  ruleDescription: {
    color: '#7f8c8d',
    fontSize: '14px',
    marginBottom: '16px'
  },
  ruleInfo: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eee'
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
  conditions: {
    marginBottom: '16px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '8px'
  },
  conditionItem: {
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    marginBottom: '4px',
    fontSize: '13px',
    color: '#2C3E50'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px'
  },
  actionButton: {
    flex: 1,
    padding: '8px 16px',
    backgroundColor: '#3498DB',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'none',
    textAlign: 'center',
    transition: 'background-color 0.2s'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '600px',
    padding: '24px',
    boxShadow: '0 20px 45px rgba(15,23,42,0.15)',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  closeButton: {
    border: 'none',
    background: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#94a3b8'
  },
  modalBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  modalLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2a37'
  },
  modalSelect: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d9e1ec',
    fontSize: '14px'
  },
  modalNotice: {
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#475569'
  },
  templatePreview: {
    padding: '16px',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  previewTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2a37'
  },
  previewSubtitle: {
    margin: '8px 0 4px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2a37'
  },
  previewDescription: {
    margin: 0,
    color: '#475569',
    fontSize: '14px'
  },
  previewItem: {
    padding: '6px 8px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    color: '#1f2a37',
    marginBottom: '4px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px'
  },
  modalButton: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600'
  },
  modalCancel: {
    backgroundColor: '#e2e8f0',
    color: '#1f2937'
  },
  modalPrimary: {
    backgroundColor: '#2563eb',
    color: 'white'
  }
};

export default Rules;
