import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dashboardService from '../services/dashboardService';

function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    devices: { total: 0, online: 0, offline: 0 },
    rules: { total: 0, active: 0, inactive: 0 },
    users: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setError(null);
    try {
      const statsData = await dashboardService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError(t('dashboard.connectionError'));
      setStats({
        devices: { total: 0, online: 0, offline: 0 },
        rules: { total: 0, active: 0, inactive: 0 },
        users: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>{t('common.loading')}</div>;
  }

  return (
    <div>
      <h1 style={styles.title}>{t('dashboard.title')}</h1>
      
      {error && (
        <div style={styles.errorBanner}>
          <strong>{t('dashboard.warning')}</strong> {error}
          <button 
            onClick={fetchStats} 
            style={styles.retryButton}
          >
            {t('dashboard.retry')}
          </button>
        </div>
      )}
      
      <div style={styles.statsGrid}>
        <div className="stat-card" style={styles.statCard}>
          <h3 style={styles.statTitle}>
            <span style={styles.statIcon}>📱</span> {t('dashboard.totalDevices')}
          </h3>
          <div style={styles.statValue}>{stats.devices.total}</div>
          <div style={styles.statDetails}>
            <span style={{ color: '#27AE60' }}>{t('dashboard.online')}: {stats.devices.online}</span>
            <span style={{ color: '#E74C3C' }}>{t('dashboard.offline')}: {stats.devices.offline}</span>
          </div>
        </div>
        
        <div className="stat-card" style={styles.statCard}>
          <h3 style={styles.statTitle}>
            <span style={styles.statIcon}>⚙️</span> {t('dashboard.totalRules')}
          </h3>
          <div style={styles.statValue}>{stats.rules.total}</div>
          <div style={styles.statDetails}>
            <span style={{ color: '#27AE60' }}>{t('common.active')}: {stats.rules.active}</span>
            <span style={{ color: '#95A5A6' }}>{t('common.inactive')}: {stats.rules.inactive}</span>
          </div>
        </div>
        
        <div className="stat-card" style={styles.statCard}>
          <h3 style={styles.statTitle}>
            <span style={styles.statIcon}>👥</span> {t('dashboard.users')}
          </h3>
          <div style={styles.statValue}>{stats.users}</div>
        </div>
      </div>

      <div style={styles.quickActions}>
        <h2 style={styles.sectionTitle}>{t('dashboard.quickActions')}</h2>
        <div style={styles.actionsGrid}>
          <Link to="/devices" className="action-card" style={styles.actionCard}>
            <h3>
              <span style={styles.actionIcon}>🔧</span> {t('dashboard.manageDevices')}
            </h3>
            <p>{t('dashboard.manageDevicesDesc')}</p>
          </Link>
          <Link to="/rules" className="action-card" style={styles.actionCard}>
            <h3>
              <span style={styles.actionIcon}>📋</span> {t('dashboard.manageRules')}
            </h3>
            <p>{t('dashboard.manageRulesDesc')}</p>
          </Link>
          <Link to="/rules/new" className="action-card" style={styles.actionCard}>
            <h3>
              <span style={styles.actionIcon}>✨</span> {t('dashboard.createRule')}
            </h3>
            <p>{t('dashboard.createRuleDesc')}</p>
          </Link>
        </div>
      </div>
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  statIcon: {
    marginRight: '8px',
    fontSize: '20px'
  },
  statTitle: {
    fontSize: '16px',
    color: '#7f8c8d',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '12px'
  },
  statDetails: {
    display: 'flex',
    gap: '16px',
    fontSize: '14px'
  },
  quickActions: {
    marginTop: '40px'
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: '20px'
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  actionCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
    display: 'block'
  },
  actionIcon: {
    marginRight: '8px',
    fontSize: '20px'
  },
  actionCardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
  },
  errorBanner: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap'
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#2C3E50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500'
  }
};

export default Dashboard;
