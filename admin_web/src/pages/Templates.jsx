import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import templatesService from '../services/templatesService';

function Templates() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [languageFilter, setLanguageFilter] = useState('all'); // all, vi, en
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, [filter, languageFilter, priorityFilter]);

  const fetchTemplates = async () => {
    try {
      const params = { 
        limit: 1000 
      };
      // Only filter by language if not 'all'
      if (languageFilter !== 'all') {
        params.language = languageFilter;
      }
      if (filter === 'active') params.isActive = 'true';
      if (filter === 'inactive') params.isActive = 'false';
      if (priorityFilter) params.priority = priorityFilter;
      
      const response = await templatesService.getAllTemplates(params);
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
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
    const operator = t(`templates.operator.${condition.operator}`, { defaultValue: condition.operator });
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
        <Link to="/templates/new" style={styles.createButton}>
          {t('templates.createTemplate')}
        </Link>
      </div>

      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t('templates.filterLanguage')}</label>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">{t('templates.allLanguages')}</option>
            <option value="vi">{t('templates.vietnamese')}</option>
            <option value="en">{t('templates.english')}</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>{t('templates.filterStatus')}</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            <option value="all">{t('common.all')} ({templates.length})</option>
            <option value="active">{t('common.active')} ({templates.filter(t => t.isActive).length})</option>
            <option value="inactive">{t('common.inactive')} ({templates.filter(t => !t.isActive).length})</option>
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
                    {template.priority}
                  </span>
                  <span style={styles.languageBadge}>
                    {template.language === 'vi' ? 'VI' : 'EN'}
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
                  {template.isActive ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>
            </div>

            <div style={styles.templateKey}>
              <span style={styles.keyLabel}>{t('templates.key')}</span>
              <span style={styles.keyValue}>{template.templateKey}</span>
            </div>

            {template.description && (
              <p style={styles.templateDescription}>{template.description}</p>
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
  }
};

export default Templates;
