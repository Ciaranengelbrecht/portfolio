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
        // Modern vibrant primary palette - Cyan/Teal accent
        primary: {
          DEFAULT: "#06B6D4",
          50: "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
          950: "#083344",
        },
        // Secondary accent - Purple/Violet for gradients
        accent: {
          DEFAULT: "#8B5CF6",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
        },
        // Warm accent for CTAs - Orange/Amber
        warm: {
          DEFAULT: "#F59E0B",
          400: "#FBBF24",
          500: "#F59E0B",
          600: "#D97706",
        },
        // Surface colors for dark mode
        surface: {
          DEFAULT: "#0F172A",
          50: "#F8FAFC",
          100: "#F1F5F9",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        secondary: "#1E293B",
        dark: "#0F172A",
        light: "#F8FAFC",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        // Hero gradients
        "hero-gradient": "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
        "mesh-gradient": "radial-gradient(at 40% 20%, hsla(180,100%,50%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(270,100%,60%,0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(180,100%,50%,0.1) 0px, transparent 50%), radial-gradient(at 80% 50%, hsla(270,100%,60%,0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(180,100%,50%,0.15) 0px, transparent 50%), radial-gradient(at 80% 100%, hsla(270,100%,60%,0.1) 0px, transparent 50%)",
        // Card gradients
        "card-gradient": "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(139,92,246,0.1) 100%)",
        "card-gradient-hover": "linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(139,92,246,0.2) 100%)",
        // Glow effects
        "glow-conic": "conic-gradient(from 180deg at 50% 50%, #06B6D4 0deg, #8B5CF6 180deg, #06B6D4 360deg)",
      },
      boxShadow: {
        "glow-sm": "0 0 15px -3px rgba(6,182,212,0.4), 0 0 6px -2px rgba(139,92,246,0.3)",
        "glow": "0 0 25px -5px rgba(6,182,212,0.5), 0 0 10px -3px rgba(139,92,246,0.4)",
        "glow-lg": "0 0 35px -5px rgba(6,182,212,0.6), 0 0 20px -5px rgba(139,92,246,0.5)",
        "glow-xl": "0 0 50px -10px rgba(6,182,212,0.7), 0 0 30px -10px rgba(139,92,246,0.6)",
        "inner-glow": "inset 0 0 20px -5px rgba(6,182,212,0.3)",
        "card": "0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2)",
        "card-hover": "0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3)",
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
