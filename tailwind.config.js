/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#9CA3AF", // Medium grey (previously blue)
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        brand: {
          50: '#ECFDFF',
          100: '#C5F6FF',
          200: '#9EECFF',
            300: '#6FE0FF',
          400: '#36D1FF',
          500: '#00B9FF', // core neon blue
          600: '#0092CC',
          700: '#006A94',
          800: '#004966',
          900: '#022A3A'
        },
        electric: {
          500: '#4D5BFF',
          600: '#2F3BFF'
        },
        secondary: "#111827",
        accent: "#4B5563", // Dark grey for accents
        dark: "#111827",
        light: "#F9FAFB",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        'brand-glow': 'radial-gradient(circle at 30% 30%, rgba(0,185,255,0.25), transparent 70%)',
        'brand-glow-strong': 'radial-gradient(circle at 70% 60%, rgba(77,91,255,0.35), transparent 75%)'
      },
      boxShadow: {
        'glow-sm': '0 0 6px -1px rgba(0,185,255,0.6), 0 0 12px -2px rgba(77,91,255,0.4)',
        'glow': '0 0 12px -2px rgba(0,185,255,0.75),0 0 30px -6px rgba(77,91,255,0.6)',
        'glow-xl': '0 0 25px -4px rgba(0,185,255,0.85),0 0 60px -10px rgba(77,91,255,0.8)'
      },
      animation: {
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        float: 'float 12s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(-6px)' },
          '50%': { transform: 'translateY(6px)' }
        }
      }
    },
  },
  plugins: [],
};
