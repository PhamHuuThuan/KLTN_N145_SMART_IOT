import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';

function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.navContent}>
          <div style={styles.logo}>
            <h2>Smart IoT Admin</h2>
          </div>
          
          <div style={styles.navLinks}>
            <Link 
              to="/" 
              style={{...styles.navLink, ...(isActive('/') && styles.navLinkActive)}}
            >
              {t('nav.dashboard')}
            </Link>
            <Link 
              to="/devices" 
              style={{...styles.navLink, ...(isActive('/devices') && styles.navLinkActive)}}
            >
              {t('nav.devices')}
            </Link>
            <Link 
              to="/rules" 
              style={{...styles.navLink, ...(isActive('/rules') && styles.navLinkActive)}}
            >
              {t('nav.rules')}
            </Link>
            <Link 
              to="/templates" 
              style={{...styles.navLink, ...(isActive('/templates') && styles.navLinkActive)}}
            >
              {t('nav.templates')}
            </Link>
          </div>
          
          <div style={styles.userSection}>
            <select
              value={currentLanguage}
              onChange={(e) => changeLanguage(e.target.value)}
              style={styles.languageSelect}
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
            <span style={styles.userName}>{user?.name || 'Admin'}</span>
            <button onClick={onLogout} style={styles.logoutButton}>
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </nav>
      
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  navbar: {
    backgroundColor: '#2C3E50',
    color: 'white',
    padding: '0 20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  navContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '64px'
  },
  logo: {
    fontSize: '20px',
    fontWeight: 'bold'
  },
  navLinks: {
    display: 'flex',
    gap: '20px',
    flex: 1,
    justifyContent: 'center'
  },
  navLink: {
    color: 'white',
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
    fontSize: '16px'
  },
  navLinkActive: {
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  languageSelect: {
    padding: '6px 12px',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '60px',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'white\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: '28px'
  },
  userName: {
    fontSize: '14px'
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#E74C3C',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px'
  }
};

export default Layout;
