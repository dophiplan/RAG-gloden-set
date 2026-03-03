import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Blue Theme (Default)
        primary: {
          DEFAULT: '#818CF8',
          hover: '#6366F1',
          active: '#4F46E5',
          light: '#E0E7FF',
          lighter: '#C7D2FE',
        },
        secondary: '#A5B4FC',
        text: {
          main: '#2C3E50',
          secondary: '#546E7A',
          muted: '#90A4AE',
        },
        background: {
          DEFAULT: '#FAFAFA',
          secondary: '#F5F5F5',
        },
        border: {
          DEFAULT: '#C7D2FE',
          light: '#E0E7FF',
          divider: '#D4E3FC',
        },
        surface: '#FFFFFF',
        
        // White Theme Colors (Clean Dashboard Style)
        'white-theme': {
          primary: '#3B82F6', // Soft Blue
          secondary: '#6B7280',
          accent: '#22C55E', // Emerald Green
          warning: '#F59E0B', // Amber Orange
          danger: '#EF4444', // Red
          background: '#FFFFFF',
          surface: '#F9FAFB',
          border: '#E5E7EB',
          text: {
            main: '#111827',
            secondary: '#6B7280',
            muted: '#9CA3AF',
          },
        },
      },
      borderRadius: {
        'sm': '12px',
        'md': '16px',
        'lg': '20px',
        'xl': '24px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(129, 140, 248, 0.08)',
        'md': '0 4px 16px rgba(129, 140, 248, 0.12)',
        'lg': '0 8px 24px rgba(129, 140, 248, 0.15)',
        // White theme shadows
        'white-sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'white-md': '0 4px 6px rgba(0, 0, 0, 0.07)',
        'white-lg': '0 10px 15px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
export default config
