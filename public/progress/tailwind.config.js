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
      borderRadius: {
        '2xl': '1rem'
      },
      boxShadow: {
        soft: '0 6px 24px -10px rgba(0,0,0,0.4)'
      }
    }
  },
  plugins: [],
}
