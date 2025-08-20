/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0f14',
        card: '#111826',
        brand: {
          50: '#e7f1ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        }
      },
      spacing: {
        '1.5': '0.375rem',
        '2.5': '0.625rem',
        '3.5': '0.875rem'
      },
      fontSize: {
        '2xs': ['0.68rem', { lineHeight: '1.1' }],
        'xs': ['0.75rem', { lineHeight: '1.15' }],
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': '1rem'
      },
      boxShadow: {
        soft: '0 6px 24px -10px rgba(0,0,0,0.4)'
      }
    }
  },
  plugins: [],
}
