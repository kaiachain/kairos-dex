'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThemeMode, THEME_STORAGE_KEY } from '@/config/theme';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or default to dark
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
    setThemeState(initialTheme);
    setMounted(true);
  }, []);

  // Apply theme class to html element
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    
    // Remove both classes first
    root.classList.remove('dark', 'light');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Update body background
    document.body.style.backgroundColor = theme === 'dark' ? '#111111' : '#f7f7f7';
    
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
