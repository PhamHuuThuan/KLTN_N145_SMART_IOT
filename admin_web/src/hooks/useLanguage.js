import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const useLanguage = () => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'vi');

  const changeLanguage = async (languageCode) => {
    try {
      await i18n.changeLanguage(languageCode);
      setCurrentLanguage(languageCode);
      localStorage.setItem('admin-language', languageCode);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  useEffect(() => {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('admin-language');
    if (savedLanguage && (savedLanguage === 'vi' || savedLanguage === 'en')) {
      i18n.changeLanguage(savedLanguage);
      setCurrentLanguage(savedLanguage);
    } else {
      // Default to Vietnamese
      i18n.changeLanguage('vi');
      setCurrentLanguage('vi');
    }
  }, []);

  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  return {
    currentLanguage,
    changeLanguage,
    t: i18n.t.bind(i18n)
  };
};

