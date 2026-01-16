// KAIA Portal Theme Configuration
// Based on COLOR_SCHEME_PROMPT.md specifications

export type ThemeMode = 'dark' | 'light';

// Background Colors
export const BACKGROUND_DARK = '#111111';
export const BACKGROUND_LIGHT = '#f7f7f7';

// Primary Colors (Brand/Lime Green)
export const PRIMARY_DARK = '#BFF009';
export const PRIMARY_LIGHT = '#ACD808';

// Text Colors
export const TEXT_PRIMARY_DARK = '#ffffff';
export const TEXT_SECONDARY_DARK = '#AFAFAF';
export const TEXT_PRIMARY_LIGHT = '#040404';
export const TEXT_SECONDARY_LIGHT = '#4C4C4C';

// Semantic Colors - Error
export const ERROR_DARK = '#E85B56';
export const ERROR_LIGHT = '#EB807A';

// Semantic Colors - Success
export const SUCCESS_DARK = '#40AB2B';
export const SUCCESS_LIGHT = '#57CF3F';

// Secondary/Neutral Colors
export const SECONDARY_DARK = '#667085';
export const SECONDARY_LIGHT = '#9e9e9e';

// Input/Form Colors
export const INPUT_BG_DARK = '#040404';
export const INPUT_BG_LIGHT = '#ffffff';

// Toast/Notification Colors
export const TOAST_BG = '#1f5214';
export const TOAST_BORDER = '#40ab2b40'; // 40% opacity
export const TOAST_SHADOW = 'rgba(87, 207, 63, 0.251)';
export const TOAST_BORDER_RADIUS = '16px';

// Theme Objects
export const darkTheme = {
  mode: 'dark' as const,
  background: BACKGROUND_DARK,
  primary: PRIMARY_DARK,
  text: {
    primary: TEXT_PRIMARY_DARK,
    secondary: TEXT_SECONDARY_DARK,
  },
  error: ERROR_DARK,
  success: SUCCESS_DARK,
  secondary: SECONDARY_DARK,
  input: {
    background: INPUT_BG_DARK,
    text: TEXT_PRIMARY_DARK,
  },
  toast: {
    background: TOAST_BG,
    border: TOAST_BORDER,
    shadow: TOAST_SHADOW,
    borderRadius: TOAST_BORDER_RADIUS,
  },
};

export const lightTheme = {
  mode: 'light' as const,
  background: BACKGROUND_LIGHT,
  primary: PRIMARY_LIGHT,
  text: {
    primary: TEXT_PRIMARY_LIGHT,
    secondary: TEXT_SECONDARY_LIGHT,
  },
  error: ERROR_LIGHT,
  success: SUCCESS_LIGHT,
  secondary: SECONDARY_LIGHT,
  input: {
    background: INPUT_BG_LIGHT,
    text: TEXT_PRIMARY_LIGHT,
  },
  toast: {
    background: TOAST_BG,
    border: TOAST_BORDER,
    shadow: TOAST_SHADOW,
    borderRadius: TOAST_BORDER_RADIUS,
  },
};

export type Theme = typeof darkTheme | typeof lightTheme;

// Helper function to get theme based on mode
export function getTheme(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

// LocalStorage key for theme preference
export const THEME_STORAGE_KEY = 'kaia-theme-mode';
