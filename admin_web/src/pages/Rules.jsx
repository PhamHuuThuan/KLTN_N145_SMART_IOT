import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import rulesService from '../services/rulesService';
import devicesService from '../services/devicesService';
import templatesService from '../services/templatesService';

function Rules() {
  const { t } = useTranslation();
  const [allRules, setAllRules] = useState([]); // All rules for counting
  const [rules, setRules] = useState([]); // Filtered rules for display
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [deviceFilter, setDeviceFilter] = useState('');
  const [devices, setDevices] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState('single'); // 'single' or 'bulk'
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedDeviceForCreate, setSelectedDeviceForCreate] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);
  // Bulk create state
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

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
      // Fetch all rules first for counting
      const allParams = { limit: 1000 };
      const allResponse = await rulesService.getAllRules(allParams);
      const allRulesData = allResponse.data || [];
      setAllRules(allRulesData);
      
      // Then apply filters for display
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
      // Sort templates by priority: urgent > high > medium > low
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const sortedTemplates = (response.data || []).sort((a, b) => {
        const aPriority = priorityOrder[a.priority] ?? 99;
        const bPriority = priorityOrder[b.priority] ?? 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        // If same priority, sort by name
        return a.name.localeCompare(b.name);
      });
      setTemplates(sortedTemplates);
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
    setCreateMode('single');
    setSelectedTemplates([]);
    setSelectedDevices([]);
    setBulkProgress({ current: 0, total: 0, success: 0, failed: 0 });
  };

  const getCreatedByObjectId = () => {
    let createdByObjectId = null;
    try {
      const token = localStorage.getItem('admin_auth_token');
      if (token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const decoded = JSON.parse(jsonPayload);
        createdByObjectId = decoded.id;
      }
    } catch (e) {
      console.error('Error decoding JWT token:', e);
    }
    return createdByObjectId;
  };

  // Prevent creating duplicate rule (same device + template name)
  const isDuplicateRule = (template, deviceId) => {
    return allRules.some(
      (rule) =>
        rule.deviceId === deviceId &&
        rule.name === template.name &&
        !rule.deletedAt
    );
  };

  const createRuleFromTemplate = async (template, deviceId) => {
    if (isDuplicateRule(template, deviceId)) {
      throw new Error('duplicate_rule_for_device');
    }

    const targetDevice = devices.find((d) => d.deviceId === deviceId);
    const createdByObjectId = getCreatedByObjectId();
    
    const payload = {
      name: template.name,
      description: template.description,
      deviceId: deviceId,
      priority: template.priority,
      conditions: template.conditions,
      actions: template.actions,
      cooldownPeriod: template.cooldownPeriod,
      isActive: template.isActive !== undefined ? template.isActive : true
    };
    
    // Priority: Use device owner's ID first, fallback to admin ID if no owner
    if (targetDevice?.ownerId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(targetDevice.ownerId));
      if (isObjectId) {
        payload.createdBy = targetDevice.ownerId;
      } else if (createdByObjectId) {
        payload.createdBy = createdByObjectId;
      }
    } else if (createdByObjectId) {
      payload.createdBy = createdByObjectId;
    }
    
    return await rulesService.createRule(payload);
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
      await createRuleFromTemplate(selectedTemplate, selectedDeviceForCreate);
      alert(t('rules.createSuccess'));
      closeCreateModal();
      fetchRules();
    } catch (error) {
      console.error('Error creating rule from template:', error);
      if (error.message === 'duplicate_rule_for_device') {
        alert(t('rules.duplicateRuleForDevice') || 'Rule từ template này đã tồn tại cho thiết bị đã chọn.');
      } else {
        alert(t('rules.createError'));
      }
    } finally {
      setCreatingRule(false);
    }
  };

  const handleBulkCreateRules = async () => {
    if (selectedTemplates.length === 0) {
      alert(t('rules.bulkSelectTemplates'));
      return;
    }
    if (selectedDevices.length === 0) {
      alert(t('rules.bulkSelectDevices'));
      return;
    }

    const total = selectedTemplates.length * selectedDevices.length;
    setBulkProgress({ current: 0, total, success: 0, failed: 0 });
    setBulkCreating(true);

    let successCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < selectedTemplates.length; i++) {
        const templateKey = selectedTemplates[i];
        const [key, language] = templateKey.split('::');
        const template = templates.find(
          (tpl) => tpl.templateKey === key && tpl.language === language
        );

        if (!template) continue;

        for (let j = 0; j < selectedDevices.length; j++) {
          const deviceId = selectedDevices[j];
          const current = i * selectedDevices.length + j + 1;

          try {
            await createRuleFromTemplate(template, deviceId);
            successCount++;
            setBulkProgress({ current, total, success: successCount, failed: failedCount });
          } catch (error) {
            const isDup = error.message === 'duplicate_rule_for_device';
            console.error(`Error creating rule for template ${template.name} and device ${deviceId}:`, error);
            failedCount++;
            setBulkProgress({ current, total, success: successCount, failed: failedCount });
            if (isDup) {
              // Skip creating duplicates silently and keep looping
              continue;
            }
          }

          // Small delay to avoid overwhelming the server
          if (current < total) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      alert(t('rules.bulkCreateComplete', { success: successCount, failed: failedCount, total }));
      closeCreateModal();
      fetchRules();
    } catch (error) {
      console.error('Error in bulk create:', error);
      alert(t('rules.bulkCreateError'));
    } finally {
      setBulkCreating(false);
    }
  };

  const toggleTemplateSelection = (templateKey) => {
    setSelectedTemplates(prev => 
      prev.includes(templateKey)
        ? prev.filter(key => key !== templateKey)
        : [...prev, templateKey]
    );
  };

  const toggleDeviceSelection = (deviceId) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAllTemplates = () => {
    if (selectedTemplates.length === templates.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(templates.map(t => `${t.templateKey}::${t.language}`));
    }
  };

  const selectAllDevices = () => {
    if (selectedDevices.length === devices.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(devices.map(d => d.deviceId));
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
            <option value="all">{t('common.all')} ({allRules.length})</option>
            <option value="active">{t('common.active')} ({allRules.filter(r => r.isActive).length})</option>
            <option value="inactive">{t('common.inactive')} ({allRules.filter(r => !r.isActive).length})</option>
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
                  {t(`templateEditor.priorities.${rule.priority}`, { defaultValue: rule.priority })}
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
              <div style={styles.ruleDescription}>
                <span style={styles.descriptionLabel}>{t('rules.description', { defaultValue: 'Mô tả' })}: </span>
                <span>{rule.description}</span>
              </div>
            )}

            <div style={styles.ruleInfo}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('rules.deviceId')}:</span>
                <span style={styles.infoValue}>{rule.deviceId}</span>
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

            {/* Mode Tabs */}
            <div style={styles.modeTabs}>
              <button
                type="button"
                onClick={() => setCreateMode('single')}
                style={{
                  ...styles.modeTab,
                  ...(createMode === 'single' ? styles.modeTabActive : {})
                }}
              >
                {t('rules.singleMode')}
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('bulk')}
                style={{
                  ...styles.modeTab,
                  ...(createMode === 'bulk' ? styles.modeTabActive : {})
                }}
              >
                {t('rules.bulkMode')}
              </button>
            </div>

            <div style={styles.modalBody}>
              {templatesLoading && (
                <div style={styles.modalNotice}>{t('common.loading')}</div>
              )}

              {!templatesLoading && templates.length === 0 && (
                <div style={styles.modalNotice}>{t('rules.noActiveTemplates')}</div>
              )}

              {templates.length > 0 && createMode === 'single' && (
                <>
                  <div style={styles.modalField}>
                    <label style={styles.modalLabel}>{t('rules.selectTemplate')}</label>
                    <select
                      value={selectedTemplateKey}
                      onChange={(e) => setSelectedTemplateKey(e.target.value)}
                      style={styles.modalSelect}
                    >
                      <option value="">{t('rules.selectTemplatePlaceholder')}</option>
                      {(() => {
                        // Sort templates by priority: urgent > high > medium > low
                        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                        const sortedTemplates = [...templates].sort((a, b) => {
                          const aPriority = priorityOrder[a.priority] ?? 99;
                          const bPriority = priorityOrder[b.priority] ?? 99;
                          if (aPriority !== bPriority) return aPriority - bPriority;
                          return a.name.localeCompare(b.name);
                        });
                        return sortedTemplates.map((template) => (
                          <option
                            key={`${template.templateKey}-${template.language}`}
                            value={`${template.templateKey}::${template.language}`}
                          >
                            {template.name} ({template.language.toUpperCase()}) - {template.priority}
                          </option>
                        ));
                      })()}
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

              {templates.length > 0 && createMode === 'bulk' && (
                <>
                  <div style={styles.bulkSection}>
                    <div style={styles.bulkSectionHeader}>
                      <label style={styles.modalLabel}>{t('rules.bulkSelectTemplates')}</label>
                      <button
                        type="button"
                        onClick={selectAllTemplates}
                        style={styles.selectAllButton}
                      >
                        {selectedTemplates.length === templates.length
                          ? t('rules.deselectAll')
                          : t('rules.selectAll')}
                      </button>
                    </div>
                    <div style={styles.checkboxList}>
                      {/* Group by language */}
                      {['vi', 'en'].map((lang) => {
                        const langTemplates = templates.filter(t => t.language === lang);
                        if (langTemplates.length === 0) return null;
                        
                        // Sort by priority: urgent > high > medium > low
                        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                        const sortedLangTemplates = [...langTemplates].sort((a, b) => {
                          const aPriority = priorityOrder[a.priority] ?? 99;
                          const bPriority = priorityOrder[b.priority] ?? 99;
                          if (aPriority !== bPriority) return aPriority - bPriority;
                          return a.name.localeCompare(b.name);
                        });
                        
                        const langSelected = sortedLangTemplates.filter(t => 
                          selectedTemplates.includes(`${t.templateKey}::${t.language}`)
                        );
                        const allLangSelected = langSelected.length === sortedLangTemplates.length;
                        
                        return (
                          <div key={lang} style={styles.languageGroup}>
                            <div style={styles.languageGroupHeader}>
                              <label style={styles.languageGroupLabel}>
                                <input
                                  type="checkbox"
                                  checked={allLangSelected}
                                  onChange={() => {
                                    if (allLangSelected) {
                                      // Deselect all in this language
                                      const keysToRemove = sortedLangTemplates.map(t => `${t.templateKey}::${t.language}`);
                                      setSelectedTemplates(prev => prev.filter(key => !keysToRemove.includes(key)));
                                    } else {
                                      // Select all in this language
                                      const keysToAdd = sortedLangTemplates.map(t => `${t.templateKey}::${t.language}`);
                                      setSelectedTemplates(prev => [...new Set([...prev, ...keysToAdd])]);
                                    }
                                  }}
                                  style={styles.checkbox}
                                />
                                <strong style={styles.languageGroupTitle}>
                                  {lang === 'vi' ? t('templates.vietnamese') : t('templates.english')} ({sortedLangTemplates.length})
                                </strong>
                              </label>
                            </div>
                            <div style={styles.languageGroupContent}>
                              {sortedLangTemplates.map((template) => {
                                const templateKey = `${template.templateKey}::${template.language}`;
                                const isSelected = selectedTemplates.includes(templateKey);
                                return (
                                  <label key={templateKey} style={styles.checkboxItem}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleTemplateSelection(templateKey)}
                                      style={styles.checkbox}
                                    />
                                    <span>
                                      {template.name} - {template.priority}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={styles.selectionCount}>
                      {t('rules.selectedTemplates', { count: selectedTemplates.length, total: templates.length })}
                    </div>
                  </div>

                  <div style={styles.bulkSection}>
                    <div style={styles.bulkSectionHeader}>
                      <label style={styles.modalLabel}>{t('rules.bulkSelectDevices')}</label>
                      <button
                        type="button"
                        onClick={selectAllDevices}
                        style={styles.selectAllButton}
                      >
                        {selectedDevices.length === devices.length
                          ? t('rules.deselectAll')
                          : t('rules.selectAll')}
                      </button>
                    </div>
                    <div style={styles.checkboxList}>
                      {devices.map((device) => {
                        const isSelected = selectedDevices.includes(device.deviceId);
                        return (
                          <label key={device._id} style={styles.checkboxItem}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleDeviceSelection(device.deviceId)}
                              style={styles.checkbox}
                            />
                            <span>
                              {device.name} ({device.deviceId})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={styles.selectionCount}>
                      {t('rules.selectedDevices', { count: selectedDevices.length, total: devices.length })}
                    </div>
                  </div>

                  {selectedTemplates.length > 0 && selectedDevices.length > 0 && (
                    <div style={styles.bulkInfo}>
                      <strong>{t('rules.bulkCreateInfo')}</strong>
                      <p>
                        {t('rules.bulkCreateInfoText', {
                          templates: selectedTemplates.length,
                          devices: selectedDevices.length,
                          total: selectedTemplates.length * selectedDevices.length
                        })}
                      </p>
                    </div>
                  )}

                  {bulkCreating && (
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${(bulkProgress.current / bulkProgress.total) * 100}%`
                          }}
                        />
                      </div>
                      <div style={styles.progressText}>
                        {t('rules.bulkProgress', {
                          current: bulkProgress.current,
                          total: bulkProgress.total,
                          success: bulkProgress.success,
                          failed: bulkProgress.failed
                        })}
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
                disabled={bulkCreating}
              >
                {t('common.cancel')}
              </button>
              {createMode === 'single' ? (
                <button
                  type="button"
                  onClick={handleCreateRuleFromTemplate}
                  style={{ ...styles.modalButton, ...styles.modalPrimary }}
                  disabled={!selectedTemplate || !selectedDeviceForCreate || creatingRule}
                >
                  {creatingRule ? t('common.processing') : t('rules.createRuleConfirm')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBulkCreateRules}
                  style={{ ...styles.modalButton, ...styles.modalPrimary }}
                  disabled={
                    selectedTemplates.length === 0 ||
                    selectedDevices.length === 0 ||
                    bulkCreating
                  }
                >
                  {bulkCreating
                    ? t('rules.bulkCreating')
                    : t('rules.bulkCreateButton', {
                        count: selectedTemplates.length * selectedDevices.length
                      })}
                </button>
              )}
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
  descriptionLabel: {
    fontWeight: '500',
    color: '#2C3E50'
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
  },
  modeTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: '2px solid #e2e8f0'
  },
  modeTab: {
    padding: '10px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    transition: 'all 0.2s'
  },
  modeTabActive: {
    color: '#2563eb',
    borderBottomColor: '#2563eb'
  },
  bulkSection: {
    marginBottom: '20px'
  },
  bulkSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  selectAllButton: {
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#475569',
    fontWeight: '500'
  },
  checkboxList: {
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#f8fafc'
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#1f2937',
    transition: 'background-color 0.2s'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  selectionCount: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#64748b',
    fontStyle: 'italic'
  },
  bulkInfo: {
    padding: '12px',
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    marginTop: '16px'
  },
  progressContainer: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  progressBar: {
    width: '100%',
    height: '24px',
    backgroundColor: '#e2e8f0',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500'
  },
  progressText: {
    fontSize: '13px',
    color: '#475569',
    textAlign: 'center'
  },
  languageGroup: {
    marginBottom: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  languageGroupHeader: {
    padding: '10px 12px',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #e2e8f0'
  },
  languageGroupLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937'
  },
  languageGroupTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937'
  },
  languageGroupContent: {
    padding: '8px',
    backgroundColor: '#ffffff'
  }
};

export default Rules;
