import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import templatesService from '../services/templatesService';
import { DEFAULT_TEMPLATES } from '../constants/defaultTemplates';

function Templates() {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const [allTemplates, setAllTemplates] = useState([]); // All templates for counting
  const [templates, setTemplates] = useState([]); // Filtered templates for display
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [priorityFilter, setPriorityFilter] = useState('');
  // Bulk create state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState([]); // Array of {templateKey, language}
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0, skipped: 0 });

  useEffect(() => {
    fetchTemplates();
  }, [filter, currentLanguage, priorityFilter]);

  const fetchTemplates = async () => {
    try {
      // Fetch all templates first for counting
      const allParams = { limit: 1000 };
      const allResponse = await templatesService.getAllTemplates(allParams);
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const allSorted = (allResponse.data || []).sort((a, b) => {
        const aPriority = priorityOrder[a.priority] ?? 99;
        const bPriority = priorityOrder[b.priority] ?? 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.templateKey.localeCompare(b.templateKey);
      });
      setAllTemplates(allSorted);
      
      // Then apply filters for display
      const params = { 
        limit: 1000,
        language: currentLanguage // Always filter by current language from menu
      };
      if (filter === 'active') params.isActive = 'true';
      if (filter === 'inactive') params.isActive = 'false';
      if (priorityFilter) params.priority = priorityFilter;
      
      const response = await templatesService.getAllTemplates(params);
      const sorted = (response.data || []).sort((a, b) => {
        const aPriority = priorityOrder[a.priority] ?? 99;
        const bPriority = priorityOrder[b.priority] ?? 99;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.templateKey.localeCompare(b.templateKey);
      });
      setTemplates(sorted);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (templateKey, currentStatus, language) => {
    try {
      const response = await templatesService.toggleTemplateStatus(templateKey, language, !currentStatus);
      if (response.success) {
        fetchTemplates();
      } else {
        alert('Lỗi: ' + (response.message || 'Không thể cập nhật trạng thái'));
      }
    } catch (error) {
      console.error('Error toggling template status:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Lỗi khi cập nhật trạng thái mẫu';
      alert(t('templates.toggleError') + ': ' + errorMessage);
    }
  };

  const handleDelete = async (templateKey, language) => {
    if (!window.confirm(t('templates.deleteConfirm'))) {
      return;
    }
    
    try {
      await templatesService.deleteTemplate(templateKey, language);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert(t('templates.deleteError'));
    }
  };

  const toggleTemplateSelection = (templateKey, language) => {
    const key = `${templateKey}::${language}`;
    setSelectedTemplates(prev => 
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const selectAllTemplatesInLanguage = (language) => {
    const languageTemplates = DEFAULT_TEMPLATES[language];
    if (!languageTemplates) return;

    const allKeys = Object.keys(languageTemplates).map(key => `${key}::${language}`);
    const allSelected = allKeys.every(key => selectedTemplates.includes(key));

    if (allSelected) {
      // Deselect all in this language
      setSelectedTemplates(prev => prev.filter(key => !allKeys.includes(key)));
    } else {
      // Select all in this language (only those that don't exist)
      const keysToAdd = allKeys.filter(key => {
        const [templateKey, lang] = key.split('::');
        return !allTemplates.some(t => t.templateKey === templateKey && t.language === lang);
      });
      setSelectedTemplates(prev => [...new Set([...prev, ...keysToAdd])]);
    }
  };

  const selectAllTemplates = () => {
    const allKeys = [];
    ['vi', 'en'].forEach(lang => {
      const languageTemplates = DEFAULT_TEMPLATES[lang];
      if (languageTemplates) {
        Object.keys(languageTemplates).forEach(templateKey => {
          const key = `${templateKey}::${lang}`;
          // Only include if template doesn't exist (check against allTemplates)
          if (!allTemplates.some(t => t.templateKey === templateKey && t.language === lang)) {
            allKeys.push(key);
          }
        });
      }
    });

    const allSelected = allKeys.length > 0 && allKeys.every(key => selectedTemplates.includes(key));
    
    if (allSelected) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates([...new Set(allKeys)]);
    }
  };

  const handleBulkCreateTemplates = async () => {
    if (selectedTemplates.length === 0) {
      alert(t('templates.selectTemplates'));
      return;
    }

    const templatesToCreate = [];
    
    for (const key of selectedTemplates) {
      const [templateKey, language] = key.split('::');
      const templateData = DEFAULT_TEMPLATES[language]?.[templateKey];
      
      if (!templateData) continue;

      // Check if template already exists (check against allTemplates)
      const exists = allTemplates.some(t => t.templateKey === templateKey && t.language === language);
      if (!exists) {
        templatesToCreate.push({
          templateKey,
          language,
          ...templateData,
          isActive: true
        });
      }
    }

    if (templatesToCreate.length === 0) {
      alert(t('templates.allTemplatesExist'));
      return;
    }

    const totalTemplates = templatesToCreate.length;
    setBulkProgress({ current: 0, total: totalTemplates, success: 0, failed: 0, skipped: 0 });
    setBulkCreating(true);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (let i = 0; i < templatesToCreate.length; i++) {
        const template = templatesToCreate[i];
        const current = i + 1;

        try {
          await templatesService.createTemplate(template);
          successCount++;
          setBulkProgress({ current, total: totalTemplates, success: successCount, failed: failedCount, skipped: skippedCount });
        } catch (error) {
          console.error(`Error creating template ${template.templateKey} (${template.language}):`, error);
          // If template already exists, count as skipped
          if (error.response?.status === 400 || error.message?.includes('exists') || error.message?.includes('tồn tại')) {
            skippedCount++;
          } else {
            failedCount++;
          }
          setBulkProgress({ current, total: totalTemplates, success: successCount, failed: failedCount, skipped: skippedCount });
        }

        // Small delay to avoid overwhelming the server
        if (current < totalTemplates) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      alert(t('templates.bulkCreateComplete', {
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
        total: totalTemplates
      }));
      setShowBulkModal(false);
      setSelectedTemplates([]);
      setBulkProgress({ current: 0, total: 0, success: 0, failed: 0, skipped: 0 });
      fetchTemplates();
    } catch (error) {
      console.error('Error in bulk create:', error);
      alert(t('templates.bulkCreateError'));
    } finally {
      setBulkCreating(false);
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
    const sensor = t(`templates.sensor.${condition.sensor}`, { defaultValue: condition.sensor });
    const operator = condition.operator; // Use operator symbol directly instead of text
    const unit = condition.unit || '';
    
    return `${sensor} ${operator} ${condition.value}${unit}`;
  };

  const formatCooldown = (ms) => {
    if (!ms) return t('templates.unlimited');
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours} ${t('templates.hours')}`;
    if (minutes > 0) return `${minutes} ${t('templates.minutes')}`;
    return `${seconds} ${t('templates.seconds')}`;
  };

  if (loading) {
    return <div style={styles.loading}>{t('common.loading')}</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>{t('templates.title')}</h1>
        <div style={styles.headerButtons}>
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            style={{ ...styles.createButton, ...styles.bulkButton }}
          >
            {t('templates.bulkCreate')}
          </button>
          <Link to="/templates/new" style={styles.createButton}>
            {t('templates.createTemplate')}
          </Link>
        </div>
      </div>

      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t('templates.filterStatus')}</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            {(() => {
              // Filter templates by current language and priority filters for counting
              let filteredForCount = allTemplates.filter(t => t.language === currentLanguage);
              if (priorityFilter) {
                filteredForCount = filteredForCount.filter(t => t.priority === priorityFilter);
              }
              return (
                <>
                  <option value="all">{t('common.all')} ({filteredForCount.length})</option>
                  <option value="active">{t('common.active')} ({filteredForCount.filter(t => t.isActive).length})</option>
                  <option value="inactive">{t('common.inactive')} ({filteredForCount.filter(t => !t.isActive).length})</option>
                </>
              );
            })()}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t('templates.filterPriority')}</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={styles.select}
          >
            <option value="">{t('common.all')}</option>
            <option value="urgent">{t('templateEditor.priorities.urgent')}</option>
            <option value="high">{t('templateEditor.priorities.high')}</option>
            <option value="medium">{t('templateEditor.priorities.medium')}</option>
            <option value="low">{t('templateEditor.priorities.low')}</option>
          </select>
        </div>
      </div>

      <div style={styles.templatesGrid}>
        {templates.map(template => (
          <div key={`${template.templateKey}-${template.language}`} style={styles.templateCard}>
            <div style={styles.templateHeader}>
              <div>
                <h3 style={styles.templateName}>{template.name}</h3>
                <div style={styles.badges}>
                  <span
                    style={{
                      ...styles.priorityBadge,
                      backgroundColor: getPriorityColor(template.priority)
                    }}
                  >
                    {t(`templateEditor.priorities.${template.priority}`, { defaultValue: template.priority })}
                  </span>
                </div>
              </div>
              <div style={styles.templateStatus}>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: template.isActive ? '#27AE60' : '#95A5A6'
                  }}
                >
                  {template.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            </div>


            {template.description && (
              <div style={styles.templateDescription}>
                <span style={styles.descriptionLabel}>{t('templates.description', { defaultValue: 'Mô tả' })}: </span>
                <span>{template.description}</span>
              </div>
            )}

            <div style={styles.templateInfo}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>{t('templates.cooldown')}</span>
                <span style={styles.infoValue}>{formatCooldown(template.cooldownPeriod)}</span>
              </div>
            </div>

            <div style={styles.conditions}>
              <h4 style={styles.sectionTitle}>{t('templates.conditions')}</h4>
              {template.conditions?.map((condition, idx) => (
                <div key={idx} style={styles.conditionItem}>
                  {formatCondition(condition)}
                </div>
              ))}
            </div>

            <div style={styles.actions}>
              <Link
                to={`/templates/${template.templateKey}/edit?language=${template.language}`}
                style={{ ...styles.actionButton, ...styles.editButton }}
              >
                <span style={styles.actionIcon}>✏️</span>
                {t('templates.edit')}
              </Link>
              <button
                onClick={() => handleToggleStatus(template.templateKey, template.isActive, template.language)}
                style={{
                  ...styles.actionButton,
                  ...(template.isActive ? styles.pauseButton : styles.activateButton)
                }}
              >
                <span style={styles.actionIcon}>{template.isActive ? '⏸️' : '▶️'}</span>
                {template.isActive ? t('templates.pause') : t('templates.activate')}
              </button>
              <button
                onClick={() => handleDelete(template.templateKey, template.language)}
                style={{ ...styles.actionButton, ...styles.deleteButton }}
              >
                <span style={styles.actionIcon}>🗑️</span>
                {t('templates.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div style={styles.emptyState}>
          <p>{t('templates.noTemplates')}</p>
        </div>
      )}

      {showBulkModal && (
        <div style={styles.modalOverlay} onClick={() => setShowBulkModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2>{t('templates.bulkCreateTitle')}</h2>
              <button style={styles.closeButton} onClick={() => setShowBulkModal(false)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalField}>
                <div style={styles.bulkSectionHeader}>
                  <label style={styles.modalLabel}>{t('templates.selectTemplates')}</label>
                  <button
                    type="button"
                    onClick={selectAllTemplates}
                    style={styles.selectAllButton}
                    disabled={bulkCreating}
                  >
                    {(() => {
                      const allAvailableKeys = [];
                      ['vi', 'en'].forEach(lang => {
                        const languageTemplates = DEFAULT_TEMPLATES[lang];
                        if (languageTemplates) {
                          Object.keys(languageTemplates).forEach(templateKey => {
                            if (!allTemplates.some(t => t.templateKey === templateKey && t.language === lang)) {
                              allAvailableKeys.push(`${templateKey}::${lang}`);
                            }
                          });
                        }
                      });
                      const allSelected = allAvailableKeys.length > 0 && allAvailableKeys.every(key => selectedTemplates.includes(key));
                      return allSelected ? t('templates.deselectAll') : t('templates.selectAll');
                    })()}
                  </button>
                </div>
                <div style={styles.checkboxList}>
                  {/* Group by language */}
                  {['vi', 'en'].map((lang) => {
                    const languageTemplates = DEFAULT_TEMPLATES[lang];
                    if (!languageTemplates) return null;

                    // Sort by priority: urgent > high > medium > low
                    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                    const sortedTemplates = Object.entries(languageTemplates).sort((a, b) => {
                      const aPriority = priorityOrder[a[1].priority] ?? 99;
                      const bPriority = priorityOrder[b[1].priority] ?? 99;
                      if (aPriority !== bPriority) return aPriority - bPriority;
                      return a[1].name.localeCompare(b[1].name);
                    });

                    // Filter out existing templates (check against allTemplates, not filtered templates)
                    const availableTemplates = sortedTemplates.filter(([templateKey]) => {
                      return !allTemplates.some(t => t.templateKey === templateKey && t.language === lang);
                    });

                    if (availableTemplates.length === 0) return null;

                    const langKeys = availableTemplates.map(([templateKey]) => `${templateKey}::${lang}`);
                    const langSelected = langKeys.filter(key => selectedTemplates.includes(key));
                    const allLangSelected = langSelected.length === langKeys.length && langKeys.length > 0;

                    return (
                      <div key={lang} style={styles.languageGroup}>
                        <div style={styles.languageGroupHeader}>
                          <label style={styles.languageGroupLabel}>
                            <input
                              type="checkbox"
                              checked={allLangSelected}
                              onChange={() => selectAllTemplatesInLanguage(lang)}
                              disabled={bulkCreating}
                              style={styles.checkbox}
                            />
                            <strong style={styles.languageGroupTitle}>
                              {lang === 'vi' ? t('templates.vietnamese') : t('templates.english')} ({availableTemplates.length})
                            </strong>
                          </label>
                        </div>
                        <div style={styles.languageGroupContent}>
                          {availableTemplates.map(([templateKey, templateData]) => {
                            const key = `${templateKey}::${lang}`;
                            const isSelected = selectedTemplates.includes(key);
                            const exists = allTemplates.some(t => t.templateKey === templateKey && t.language === lang);
                            
                            return (
                              <label key={key} style={styles.checkboxItem}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTemplateSelection(templateKey, lang)}
                                  disabled={bulkCreating || exists}
                                  style={styles.checkbox}
                                />
                                <span>
                                  {templateData.name} - {templateData.priority}
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
                  {t('templates.selectedTemplates', { count: selectedTemplates.length })}
                </div>
              </div>

              {selectedTemplates.length > 0 && (
                <div style={styles.bulkInfo}>
                  <strong>{t('templates.bulkCreateInfo')}</strong>
                  <p>
                    {t('templates.bulkCreateInfoText', {
                      count: selectedTemplates.length
                    })}
                  </p>
                  <p style={styles.helpText}>
                    {t('templates.bulkCreateHint')}
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
                    {t('templates.bulkProgress', {
                      current: bulkProgress.current,
                      total: bulkProgress.total,
                      success: bulkProgress.success,
                      failed: bulkProgress.failed,
                      skipped: bulkProgress.skipped
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => {
                  setShowBulkModal(false);
                  setSelectedTemplates([]);
                  setBulkProgress({ current: 0, total: 0, success: 0, failed: 0, skipped: 0 });
                }}
                style={{ ...styles.modalButton, ...styles.modalCancel }}
                disabled={bulkCreating}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBulkCreateTemplates}
                style={{ ...styles.modalButton, ...styles.modalPrimary }}
                disabled={selectedTemplates.length === 0 || bulkCreating}
              >
                {bulkCreating
                  ? t('templates.bulkCreating')
                  : t('templates.bulkCreateButton', {
                      count: selectedTemplates.length
                    })}
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
    minWidth: '150px'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  templatesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '20px'
  },
  templateCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  templateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  templateName: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#2C3E50',
    margin: 0,
    marginBottom: '8px'
  },
  badges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
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
  languageBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    backgroundColor: '#9B59B6',
    color: 'white',
    fontSize: '12px',
    fontWeight: '500',
    display: 'inline-block'
  },
  templateStatus: {
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
  templateKey: {
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontSize: '13px'
  },
  keyLabel: {
    color: '#7f8c8d',
    fontWeight: '500',
    marginRight: '8px'
  },
  keyValue: {
    color: '#2C3E50',
    fontFamily: 'monospace'
  },
  templateDescription: {
    color: '#7f8c8d',
    fontSize: '14px',
    marginBottom: '16px'
  },
  descriptionLabel: {
    fontWeight: '500',
    color: '#2C3E50'
  },
  templateInfo: {
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
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #e0e5ec',
    backgroundColor: '#f7f8fa',
    color: '#2C3E50',
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'none',
    textAlign: 'center',
    transition: 'background-color 0.2s, border-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  editButton: {
    borderColor: '#d7e3ff',
    backgroundColor: '#f2f5ff'
  },
  pauseButton: {
    borderColor: '#ffe3ba',
    backgroundColor: '#fff7e9'
  },
  activateButton: {
    borderColor: '#c9f1da',
    backgroundColor: '#f0fff7'
  },
  deleteButton: {
    borderColor: '#ffd6d6',
    backgroundColor: '#fff1f1',
    color: '#c0392b'
  },
  actionIcon: {
    fontSize: '16px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  headerButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  bulkButton: {
    backgroundColor: '#9B59B6'
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
  checkboxList: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    maxHeight: '400px',
    overflowY: 'auto'
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
  helpText: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: '8px'
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
    backgroundColor: '#9B59B6',
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
    backgroundColor: '#9B59B6',
    color: 'white'
  }
};

export default Templates;
