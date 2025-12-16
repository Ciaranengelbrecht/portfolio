/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Monochrome Silver/Steel primary palette
        primary: {
          DEFAULT: "#A8B2C1",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#A8B2C1",
          600: "#64748B",
          700: "#475569",
          800: "#334155",
          900: "#1E293B",
          950: "#0F172A",
        },
        // Accent - Warm silver/champagne for highlights
        accent: {
          DEFAULT: "#D4D4D8",
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          800: "#27272A",
          900: "#18181B",
        },
        // Subtle warm accent for CTAs - Soft gold
        warm: {
          DEFAULT: "#D4AF37",
          400: "#E5C158",
          500: "#D4AF37",
          600: "#B8962F",
        },
        // Surface colors for dark mode - Deep charcoal
        surface: {
          DEFAULT: "#111111",
          50: "#FAFAFA",
          100: "#F5F5F5",
          800: "#1A1A1A",
          900: "#111111",
          950: "#0A0A0A",
        },
        secondary: "#1A1A1A",
        dark: "#111111",
        light: "#FAFAFA",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Hero gradients - Monochrome steel
        "hero-gradient": "linear-gradient(135deg, #111111 0%, #1A1A1A 50%, #111111 100%)",
        "mesh-gradient": "radial-gradient(at 40% 20%, hsla(220,10%,50%,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(220,10%,60%,0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(220,10%,50%,0.05) 0px, transparent 50%), radial-gradient(at 80% 50%, hsla(220,10%,60%,0.05) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(220,10%,50%,0.08) 0px, transparent 50%), radial-gradient(at 80% 100%, hsla(220,10%,60%,0.05) 0px, transparent 50%)",
        // Card gradients - Silver
        "card-gradient": "linear-gradient(135deg, rgba(168,178,193,0.08) 0%, rgba(212,212,216,0.08) 100%)",
        "card-gradient-hover": "linear-gradient(135deg, rgba(168,178,193,0.15) 0%, rgba(212,212,216,0.15) 100%)",
        // Glow effects - Silver/Steel
        "glow-conic": "conic-gradient(from 180deg at 50% 50%, #A8B2C1 0deg, #D4D4D8 180deg, #A8B2C1 360deg)",
      },
      boxShadow: {
        "glow-sm": "0 0 15px -3px rgba(168,178,193,0.3), 0 0 6px -2px rgba(212,212,216,0.2)",
        "glow": "0 0 25px -5px rgba(168,178,193,0.4), 0 0 10px -3px rgba(212,212,216,0.3)",
        "glow-lg": "0 0 35px -5px rgba(168,178,193,0.5), 0 0 20px -5px rgba(212,212,216,0.4)",
        "glow-xl": "0 0 50px -10px rgba(168,178,193,0.6), 0 0 30px -10px rgba(212,212,216,0.5)",
        "inner-glow": "inset 0 0 20px -5px rgba(168,178,193,0.2)",
        "card": "0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)",
        "card-hover": "0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4)",
      },
      animation: {
        "pulse-slow": "pulse 4s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "float-slower": "float 12s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "gradient-x": "gradient-x 15s ease infinite",
        "gradient-y": "gradient-y 15s ease infinite",
        "gradient-xy": "gradient-xy 15s ease infinite",
        "spin-slow": "spin 8s linear infinite",
        "bounce-slow": "bounce 3s infinite",
        "shimmer": "shimmer 2s linear infinite",
        "border-beam": "border-beam 4s linear infinite",
        "text-shimmer": "text-shimmer 3s ease-in-out infinite",
        "scale-in": "scale-in 0.5s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "slide-down": "slide-down 0.5s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        "gradient-x": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
        "gradient-y": {
          "0%, 100%": { "background-position": "50% 0%" },
          "50%": { "background-position": "50% 100%" },
        },
        "gradient-xy": {
          "0%, 100%": { "background-position": "0% 0%" },
          "25%": { "background-position": "100% 0%" },
          "50%": { "background-position": "100% 100%" },
          "75%": { "background-position": "0% 100%" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "border-beam": {
          "0%": { "offset-distance": "0%" },
          "100%": { "offset-distance": "100%" },
        },
        "text-shimmer": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "smooth-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
