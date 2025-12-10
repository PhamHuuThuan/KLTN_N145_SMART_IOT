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
      // Silently handle error
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
      // Silently handle error
    }
  };

  const setTheme = async (theme) => {
    try {
      const isDark = theme === 'dark';
      setIsDarkMode(isDark);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Silently handle error
    }
  };

  const theme = {
    isDarkMode,
    isLoading,
    toggleTheme,
    setTheme,
    colors: isDarkMode ? {
      // Dark mode colors
      primary: '#3B82F6',           // blue-500
      secondary: '#10B981',         // emerald-500
      success: '#22C55E',           // green-500
      danger: '#EF4444',            // red-500
      warning: '#F59E0B',           // amber-500
      info: '#8B5CF6',              // violet-500
      gray: '#9CA3AF',              // gray-400
      grayLight: '#6B7280',         // gray-500
      surface: '#1F2937',           // gray-800
      surfaceSecondary: '#374151',  // gray-700
      background: '#111827',        // gray-900
      backgroundSecondary: '#1F2937', // gray-800
      border: '#374151',            // gray-700
      text: '#F9FAFB',              // gray-50
      textSecondary: '#D1D5DB',     // gray-300
      textTertiary: '#9CA3AF',      // gray-400
      white: '#FFFFFF',
      black: '#000000',
    } : {
      // Light mode colors
      primary: '#2563EB',           // blue-600
      secondary: '#14B8A6',         // teal-500
      success: '#22C55E',           // green-500
      danger: '#EF4444',            // red-500
      warning: '#F59E0B',           // amber-500
      info: '#8B5CF6',              // violet-500
      gray: '#94A3B8',              // slate-400
      grayLight: '#CBD5E1',         // slate-300
      surface: '#FFFFFF',           // white
      surfaceSecondary: '#F8FAFC',  // slate-50
      background: '#F1F5F9',        // slate-100
      backgroundSecondary: '#FFFFFF', // white
      border: '#E2E8F0',            // slate-200
      text: '#1F2937',              // gray-800
      textSecondary: '#4B5563',     // gray-600
      textTertiary: '#6B7280',      // gray-500
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
