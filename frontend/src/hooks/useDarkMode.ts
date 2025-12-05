import { useEffect, useState } from 'react';
import api from '../services/api';

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');

  useEffect(() => {
    // Load theme setting from API
    fetchThemeSetting();
    
    // Listen for system theme changes if in auto mode
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const fetchThemeSetting = async () => {
    try {
      const response = await api.get('/settings');
      if (response.data && Array.isArray(response.data)) {
        const themeSetting = response.data.find((s: any) => s.key === 'theme');
        if (themeSetting) {
          setTheme(themeSetting.value || 'auto');
          applyTheme(themeSetting.value || 'auto');
        }
      }
    } catch (error) {
      console.warn('Failed to load theme setting');
    }
  };

  const applyTheme = (themeValue?: string) => {
    const themeToApply = themeValue || theme;
    let shouldDark = false;

    if (themeToApply === 'dark') {
      shouldDark = true;
    } else if (themeToApply === 'light') {
      shouldDark = false;
    } else {
      // Auto mode - check system preference
      shouldDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    setIsDark(shouldDark);

    // Apply to document
    if (shouldDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', themeToApply);
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', themeToApply);
    }
  };

  const toggleDarkMode = (newTheme: 'auto' | 'light' | 'dark') => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return { isDark, theme, toggleDarkMode };
};
