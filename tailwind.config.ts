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
      },
    },
  },
  plugins: [],
}
export default config
