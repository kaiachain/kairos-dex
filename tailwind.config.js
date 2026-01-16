/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // KAIA Theme Colors - using CSS variables for theme switching
        bg: {
          DEFAULT: 'var(--background)',
          dark: '#111111',
          light: '#f7f7f7',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          dark: '#BFF009',
          light: '#ACD808',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          'primary-dark': '#ffffff',
          'secondary-dark': '#AFAFAF',
          'primary-light': '#040404',
          'secondary-light': '#4C4C4C',
        },
        error: {
          DEFAULT: 'var(--error)',
          dark: '#E85B56',
          light: '#EB807A',
        },
        success: {
          DEFAULT: 'var(--success)',
          dark: '#40AB2B',
          light: '#57CF3F',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          dark: '#667085',
          light: '#9e9e9e',
        },
        input: {
          bg: 'var(--input-bg)',
          text: 'var(--input-text)',
          'bg-dark': '#040404',
          'bg-light': '#ffffff',
        },
        toast: {
          bg: '#1f5214',
          border: '#40ab2b40',
        },
        // Card/Container backgrounds
        card: {
          DEFAULT: 'var(--card-bg)',
        },
        border: {
          DEFAULT: 'var(--border-color)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Red Hat Display', 'RedHatDisplay', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        toast: '16px',
      },
      boxShadow: {
        toast: '0px 8px 16px rgba(87, 207, 63, 0.251)',
      },
    },
  },
  plugins: [],
};

