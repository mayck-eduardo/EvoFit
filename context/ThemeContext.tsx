import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light' | 'auto';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  tabBarBg: string;
  tabBarBorder: string;
  primary: string;
  primaryBg: string;
  danger: string;
  success: string;
  successBg: string;
  warning: string;
}

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#2A2A2A',
  card: '#1E1E1E',
  cardBorder: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#666666',
  border: '#2A2A2A',
  inputBg: '#2C2C2C',
  inputBorder: '#3A3A3A',
  tabBarBg: '#1A1A1A',
  tabBarBorder: '#2A2A2A',
  primary: '#EF4444',
  primaryBg: '#2A1A1A',
  danger: '#EF4444',
  success: '#10B981',
  successBg: '#1A2E1A',
  warning: '#F59E0B',
};

const lightColors: ThemeColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F0',
  card: '#FFFFFF',
  cardBorder: '#E0E0E0',
  text: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  inputBg: '#F0F0F0',
  inputBorder: '#D0D0D0',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E0E0E0',
  primary: '#EF4444',
  primaryBg: '#FEE2E2',
  danger: '#EF4444',
  success: '#10B981',
  successBg: '#D1FAE5',
  warning: '#F59E0B',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('@EvoFit:themeMode').then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'auto') {
        setThemeModeState(saved);
      }
    });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem('@EvoFit:themeMode', mode);
  };

  const isDark = themeMode === 'auto' ? systemColorScheme === 'dark' : themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
