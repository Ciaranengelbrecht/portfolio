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
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        primary: {
          DEFAULT: "#7d8a99",
          50: "#f6f8f9",
          100: "#e8edf0",
          200: "#cfd8df",
          300: "#aebbc6",
          400: "#7d8a99",
          500: "#5f6b78",
          600: "#46515e",
          700: "#343d47",
          800: "#252c34",
          900: "#171d23",
          950: "#0b1015",
        },
        accent: {
          DEFAULT: "#d4af67",
          100: "#fbf3df",
          200: "#f0dca9",
          300: "#e4c577",
          400: "#d4af67",
          500: "#b98d3e",
          600: "#896427",
          700: "#5d431d",
          800: "#3d2c16",
          900: "#24190d",
        },
        warm: {
          DEFAULT: "#d4a84f",
          300: "#f0d58d",
          400: "#dfbd67",
          500: "#d4a84f",
          600: "#a97923",
          700: "#74501a",
        },
        surface: {
          DEFAULT: "#101419",
          50: "#f6f7f8",
          100: "#e7eaee",
          700: "#202832",
          800: "#171d24",
          850: "#121820",
          900: "#0d1117",
          950: "#080b0f",
        },
        secondary: "#121820",
        dark: "#0d1117",
        light: "#f6f8f9",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "ops-grid":
          "linear-gradient(rgba(125,138,153,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(125,138,153,0.07) 1px, transparent 1px)",
        "ops-scan":
          "linear-gradient(180deg, rgba(212,175,103,0.08), rgba(212,175,103,0) 35%)",
      },
      boxShadow: {
        "ops": "0 24px 70px rgba(0,0,0,0.34)",
        "ops-soft": "0 16px 44px rgba(0,0,0,0.26)",
        "focus-line": "0 0 0 1px rgba(212,175,103,0.34)",
      },
      animation: {
        "cursor-blink": "cursor-blink 1.15s steps(1) infinite",
        "scan-line": "scan-line 5s linear infinite",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
      },
      keyframes: {
        "cursor-blink": {
          "0%, 45%": { opacity: "1" },
          "46%, 100%": { opacity: "0" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
