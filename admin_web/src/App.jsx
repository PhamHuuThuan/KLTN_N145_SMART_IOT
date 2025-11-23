import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Rules from './pages/Rules';
import RuleEditor from './pages/RuleEditor';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import DeviceEditor from './pages/DeviceEditor';
import Layout from './components/Layout';
import { getAuthToken, setAuthToken, removeAuthToken } from './utils/auth';
import api from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      // Verify token by fetching user info using api instance (so it uses baseURL and auto-adds token)
      api.get('/auth/me')
        .then(response => {
          const data = response.data;
          if (data.user && data.user.role === 'admin') {
            setIsAuthenticated(true);
            setUser(data.user);
          } else {
            removeAuthToken();
            setIsAuthenticated(false);
            setUser(null);
          }
        })
        .catch((error) => {
          console.error('Auth verification error:', error);
          removeAuthToken();
          setIsAuthenticated(false);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (token, userData) => {
    setAuthToken(token);
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    removeAuthToken();
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Đang tải...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={handleLogin} />
          )
        } 
      />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <Dashboard />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/devices"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <Devices />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/devices/new"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <DeviceEditor />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/rules"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <Rules />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/rules/new"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <RuleEditor />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/rules/:ruleId/edit"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <RuleEditor />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/templates"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <Templates />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/templates/new"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <TemplateEditor />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/templates/:templateKey/edit"
        element={
          isAuthenticated ? (
            <Layout user={user} onLogout={handleLogout}>
              <TemplateEditor />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
