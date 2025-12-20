import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@theme_mode';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme ? 'dark' : 'light');
    } catch (error) {
    }
  };

  const setTheme = async (theme) => {
    try {
      const isDark = theme === 'dark';
      setIsDarkMode(isDark);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
    }
  };

  const theme = {
    isDarkMode,
    isLoading,
    toggleTheme,
    setTheme,
    colors: isDarkMode ? {
      primary: '#3B82F6',
      secondary: '#10B981',
      success: '#22C55E',
      danger: '#EF4444',
      warning: '#F59E0B',
      info: '#8B5CF6',
      gray: '#9CA3AF',
      grayLight: '#6B7280',
      surface: '#1F2937',
      surfaceSecondary: '#374151',
      background: '#111827',
      backgroundSecondary: '#1F2937',
      border: '#374151',
      text: '#F9FAFB',
      textSecondary: '#D1D5DB',
      textTertiary: '#9CA3AF',
      white: '#FFFFFF',
      black: '#000000',
    } : {
      primary: '#2563EB',
      secondary: '#14B8A6',
      success: '#22C55E',
      danger: '#EF4444',
      warning: '#F59E0B',
      info: '#8B5CF6',
      gray: '#94A3B8',
      grayLight: '#CBD5E1',
      surface: '#FFFFFF',
      surfaceSecondary: '#F8FAFC',
      background: '#F1F5F9',
      backgroundSecondary: '#FFFFFF',
      border: '#E2E8F0',
      text: '#1F2937',
      textSecondary: '#4B5563',
      textTertiary: '#6B7280',
      white: '#FFFFFF',
      black: '#000000',
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
