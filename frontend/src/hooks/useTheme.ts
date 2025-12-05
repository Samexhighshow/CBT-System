import { useEffect, useState } from 'react';
import api from '../services/api';

type Theme = 'light' | 'dark' | 'auto';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('auto');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Initial check
    updateSystemTheme(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', updateSystemTheme);
    
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  // Fetch theme from backend
  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const response = await api.get('/settings');
        const themeSetting = response.data.find((s: any) => s.key === 'theme');
        if (themeSetting) {
          setTheme(themeSetting.value as Theme);
        }
      } catch (error) {
        console.error('Failed to fetch theme setting:', error);
      }
    };

    fetchTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme = theme === 'auto' ? systemTheme : theme;

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, systemTheme]);

  const changeTheme = async (newTheme: Theme) => {
    try {
      await api.put('/settings/theme', { value: newTheme });
      setTheme(newTheme);
    } catch (error) {
      console.error('Failed to update theme:', error);
      throw error;
    }
  };

  return {
    theme,
    effectiveTheme: theme === 'auto' ? systemTheme : theme,
    changeTheme,
  };
};
