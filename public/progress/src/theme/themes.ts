// Theme System v2.0 - Redesigned for visual polish and variety
// Organized into categories: Dark, OLED, Colorful, Warm, Cool, Minimal

export type ThemeKey =
  // === DARK ESSENTIALS ===
  | "midnight"           // Clean dark blue - default
  | "obsidian"           // Deep black with subtle blue
  | "charcoal"           // Warm dark gray
  // === OLED / TRUE BLACK ===
  | "amoled"             // Pure black for OLED screens
  | "amoled-cyan"        // Pure black + cyan accent
  | "amoled-purple"      // Pure black + purple accent
  | "amoled-rose"        // Pure black + rose accent
  // === NEON / VIBRANT ===
  | "electric-blue"      // Vibrant blue neon
  | "cyber-pink"         // Hot pink cyberpunk
  | "neon-mint"          // Fresh mint green
  | "sunset"             // Orange to pink gradient feel
  | "aurora"             // Northern lights multi-color
  // === COOL TONES ===
  | "arctic"             // Icy blue-white
  | "ocean"              // Deep sea teal
  | "lavender"           // Soft purple
  | "slate"              // Professional gray-blue
  // === WARM TONES ===
  | "ember"              // Warm amber/orange
  | "crimson"            // Deep red
  | "forest"             // Natural green
  | "coffee"             // Warm brown
  // === MINIMAL / CLEAN ===
  | "paper"              // Light mode inspired
  | "mono"               // Pure grayscale
  // === CUSTOM ===
  | "custom";            // User customizable

export type ThemeVars = Record<string, string>;

export const THEMES: Record<ThemeKey, ThemeVars> = {
  // ============================================================
  // DARK ESSENTIALS - Core dark themes for everyday use
  // ============================================================
  
  midnight: {
    "--bg": "hsl(222 47% 6%)",
    "--bg-muted": "hsl(222 40% 9%)",
    "--card": "hsla(220 50% 98% / 0.05)",
    "--card-border": "hsla(220 60% 60% / 0.15)",
    "--text": "hsl(210 40% 96%)",
    "--text-muted": "hsl(215 20% 65%)",
    "--accent": "hsl(217 91% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(217 91% 60%)",
    "--shadow": "0 8px 32px hsla(220 80% 10% / 0.5)",
    "--glow": "0 0 20px hsla(217 91% 60% / 0.3)",
    "--chart-1": "hsl(217 91% 60%)",
    "--chart-2": "hsl(280 70% 65%)",
    "--chart-grid": "hsla(220 30% 80% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(12px)",
  },

  obsidian: {
    "--bg": "hsl(230 25% 5%)",
    "--bg-muted": "hsl(230 20% 8%)",
    "--card": "hsla(230 30% 95% / 0.04)",
    "--card-border": "hsla(230 40% 50% / 0.12)",
    "--text": "hsl(220 25% 93%)",
    "--text-muted": "hsl(220 15% 55%)",
    "--accent": "hsl(210 100% 55%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(210 100% 55%)",
    "--shadow": "0 10px 40px hsla(230 50% 5% / 0.6)",
    "--glow": "0 0 16px hsla(210 100% 55% / 0.25)",
    "--chart-1": "hsl(210 100% 55%)",
    "--chart-2": "hsl(170 80% 50%)",
    "--chart-grid": "hsla(230 20% 60% / 0.08)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(16px)",
  },

  charcoal: {
    "--bg": "hsl(220 10% 8%)",
    "--bg-muted": "hsl(220 8% 12%)",
    "--card": "hsl(220 8% 14%)",
    "--card-border": "hsla(220 10% 40% / 0.2)",
    "--text": "hsl(40 10% 93%)",
    "--text-muted": "hsl(40 5% 55%)",
    "--accent": "hsl(200 80% 55%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(200 80% 55%)",
    "--shadow": "0 6px 24px hsla(0 0% 0% / 0.5)",
    "--glow": "none",
    "--chart-1": "hsl(200 80% 55%)",
    "--chart-2": "hsl(150 60% 50%)",
    "--chart-grid": "hsla(220 10% 50% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  // ============================================================
  // OLED / TRUE BLACK - Perfect for AMOLED screens
  // ============================================================

  amoled: {
    "--bg": "hsl(0 0% 0%)",
    "--bg-muted": "hsl(0 0% 4%)",
    "--card": "hsl(0 0% 6%)",
    "--card-border": "hsla(220 50% 50% / 0.2)",
    "--text": "hsl(0 0% 95%)",
    "--text-muted": "hsl(0 0% 55%)",
    "--accent": "hsl(220 90% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(220 90% 60%)",
    "--shadow": "0 4px 20px hsla(0 0% 0% / 0.8)",
    "--glow": "0 0 12px hsla(220 90% 60% / 0.35)",
    "--chart-1": "hsl(220 90% 60%)",
    "--chart-2": "hsl(180 80% 50%)",
    "--chart-grid": "hsla(0 0% 100% / 0.06)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  "amoled-cyan": {
    "--bg": "hsl(0 0% 0%)",
    "--bg-muted": "hsl(185 30% 3%)",
    "--card": "hsl(185 20% 5%)",
    "--card-border": "hsla(185 100% 45% / 0.2)",
    "--text": "hsl(180 20% 95%)",
    "--text-muted": "hsl(180 10% 55%)",
    "--accent": "hsl(185 100% 50%)",
    "--accent-contrast": "hsl(0 0% 0%)",
    "--ring": "hsl(185 100% 50%)",
    "--shadow": "0 4px 20px hsla(0 0% 0% / 0.8)",
    "--glow": "0 0 16px hsla(185 100% 50% / 0.4)",
    "--chart-1": "hsl(185 100% 50%)",
    "--chart-2": "hsl(260 80% 65%)",
    "--chart-grid": "hsla(185 50% 50% / 0.08)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  "amoled-purple": {
    "--bg": "hsl(0 0% 0%)",
    "--bg-muted": "hsl(270 30% 3%)",
    "--card": "hsl(270 20% 5%)",
    "--card-border": "hsla(270 80% 60% / 0.2)",
    "--text": "hsl(270 20% 95%)",
    "--text-muted": "hsl(270 10% 55%)",
    "--accent": "hsl(270 80% 65%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(270 80% 65%)",
    "--shadow": "0 4px 20px hsla(0 0% 0% / 0.8)",
    "--glow": "0 0 16px hsla(270 80% 65% / 0.4)",
    "--chart-1": "hsl(270 80% 65%)",
    "--chart-2": "hsl(330 80% 60%)",
    "--chart-grid": "hsla(270 50% 50% / 0.08)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  "amoled-rose": {
    "--bg": "hsl(0 0% 0%)",
    "--bg-muted": "hsl(340 30% 3%)",
    "--card": "hsl(340 20% 5%)",
    "--card-border": "hsla(340 80% 60% / 0.2)",
    "--text": "hsl(340 20% 95%)",
    "--text-muted": "hsl(340 10% 55%)",
    "--accent": "hsl(340 85% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(340 85% 60%)",
    "--shadow": "0 4px 20px hsla(0 0% 0% / 0.8)",
    "--glow": "0 0 16px hsla(340 85% 60% / 0.4)",
    "--chart-1": "hsl(340 85% 60%)",
    "--chart-2": "hsl(200 90% 55%)",
    "--chart-grid": "hsla(340 50% 50% / 0.08)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  // ============================================================
  // NEON / VIBRANT - Bold, energetic themes
  // ============================================================

  "electric-blue": {
    "--bg": "hsl(230 35% 6%)",
    "--bg-muted": "hsl(230 30% 10%)",
    "--card": "hsla(220 60% 95% / 0.06)",
    "--card-border": "hsla(200 100% 55% / 0.25)",
    "--text": "hsl(210 80% 96%)",
    "--text-muted": "hsl(210 40% 65%)",
    "--accent": "hsl(200 100% 55%)",
    "--accent-contrast": "hsl(220 40% 8%)",
    "--ring": "hsl(200 100% 55%)",
    "--shadow": "0 10px 40px hsla(200 100% 50% / 0.25)",
    "--glow": "0 0 28px hsla(200 100% 55% / 0.5)",
    "--chart-1": "hsl(200 100% 55%)",
    "--chart-2": "hsl(280 90% 65%)",
    "--chart-grid": "hsla(200 50% 70% / 0.12)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(16px)",
  },

  "cyber-pink": {
    "--bg": "hsl(280 35% 6%)",
    "--bg-muted": "hsl(280 30% 10%)",
    "--card": "hsla(300 50% 95% / 0.06)",
    "--card-border": "hsla(320 100% 60% / 0.25)",
    "--text": "hsl(300 50% 96%)",
    "--text-muted": "hsl(300 20% 65%)",
    "--accent": "hsl(320 100% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(320 100% 60%)",
    "--shadow": "0 10px 40px hsla(320 100% 50% / 0.25)",
    "--glow": "0 0 32px hsla(320 100% 60% / 0.5)",
    "--chart-1": "hsl(320 100% 60%)",
    "--chart-2": "hsl(185 100% 50%)",
    "--chart-grid": "hsla(320 50% 70% / 0.12)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(16px)",
  },

  "neon-mint": {
    "--bg": "hsl(160 35% 5%)",
    "--bg-muted": "hsl(160 30% 8%)",
    "--card": "hsla(160 50% 95% / 0.05)",
    "--card-border": "hsla(160 100% 50% / 0.2)",
    "--text": "hsl(150 40% 95%)",
    "--text-muted": "hsl(150 20% 60%)",
    "--accent": "hsl(160 100% 50%)",
    "--accent-contrast": "hsl(160 50% 6%)",
    "--ring": "hsl(160 100% 50%)",
    "--shadow": "0 10px 40px hsla(160 100% 40% / 0.2)",
    "--glow": "0 0 24px hsla(160 100% 50% / 0.4)",
    "--chart-1": "hsl(160 100% 50%)",
    "--chart-2": "hsl(280 80% 60%)",
    "--chart-grid": "hsla(160 50% 60% / 0.1)",
    "--success": "hsl(160 100% 48%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(14px)",
  },

  sunset: {
    "--bg": "hsl(280 30% 7%)",
    "--bg-muted": "hsl(280 25% 11%)",
    "--card": "hsla(30 60% 95% / 0.06)",
    "--card-border": "hsla(25 100% 60% / 0.2)",
    "--text": "hsl(40 50% 95%)",
    "--text-muted": "hsl(30 30% 60%)",
    "--accent": "hsl(25 100% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(25 100% 60%)",
    "--shadow": "0 10px 40px hsla(25 100% 50% / 0.25)",
    "--glow": "0 0 28px hsla(25 100% 60% / 0.45)",
    "--chart-1": "hsl(25 100% 60%)",
    "--chart-2": "hsl(330 90% 60%)",
    "--chart-grid": "hsla(30 50% 70% / 0.12)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(50 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(16px)",
    "--bg-layer": "linear-gradient(135deg, hsla(330 80% 50% / 0.08) 0%, hsla(25 100% 50% / 0.08) 100%)",
  },

  aurora: {
    "--bg": "hsl(220 35% 6%)",
    "--bg-muted": "hsl(220 30% 10%)",
    "--card": "hsla(220 50% 98% / 0.06)",
    "--card-border": "hsla(180 80% 55% / 0.18)",
    "--text": "hsl(180 30% 95%)",
    "--text-muted": "hsl(180 15% 60%)",
    "--accent": "hsl(170 80% 55%)",
    "--accent-contrast": "hsl(220 40% 8%)",
    "--ring": "hsl(170 80% 55%)",
    "--shadow": "0 10px 40px hsla(170 80% 40% / 0.2)",
    "--glow": "0 0 24px hsla(170 80% 55% / 0.35)",
    "--chart-1": "hsl(170 80% 55%)",
    "--chart-2": "hsl(280 80% 65%)",
    "--chart-grid": "hsla(180 40% 60% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(18px)",
    "--bg-layer": "radial-gradient(ellipse 150% 100% at 20% 20%, hsla(170 80% 50% / 0.15) 0%, transparent 50%), radial-gradient(ellipse 100% 100% at 80% 80%, hsla(280 80% 55% / 0.12) 0%, transparent 50%)",
  },

  // ============================================================
  // COOL TONES - Professional and calming
  // ============================================================

  arctic: {
    "--bg": "hsl(210 30% 10%)",
    "--bg-muted": "hsl(210 25% 14%)",
    "--card": "hsla(210 50% 98% / 0.08)",
    "--card-border": "hsla(200 60% 70% / 0.15)",
    "--text": "hsl(200 50% 96%)",
    "--text-muted": "hsl(200 20% 65%)",
    "--accent": "hsl(195 85% 60%)",
    "--accent-contrast": "hsl(210 40% 10%)",
    "--ring": "hsl(195 85% 60%)",
    "--shadow": "0 8px 32px hsla(200 50% 20% / 0.3)",
    "--glow": "0 0 20px hsla(195 85% 60% / 0.3)",
    "--chart-1": "hsl(195 85% 60%)",
    "--chart-2": "hsl(220 70% 65%)",
    "--chart-grid": "hsla(200 40% 70% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(14px)",
  },

  ocean: {
    "--bg": "hsl(200 50% 7%)",
    "--bg-muted": "hsl(200 45% 11%)",
    "--card": "hsla(190 60% 95% / 0.06)",
    "--card-border": "hsla(180 70% 50% / 0.18)",
    "--text": "hsl(180 30% 94%)",
    "--text-muted": "hsl(180 15% 58%)",
    "--accent": "hsl(180 75% 50%)",
    "--accent-contrast": "hsl(200 50% 8%)",
    "--ring": "hsl(180 75% 50%)",
    "--shadow": "0 10px 36px hsla(180 60% 30% / 0.25)",
    "--glow": "0 0 22px hsla(180 75% 50% / 0.35)",
    "--chart-1": "hsl(180 75% 50%)",
    "--chart-2": "hsl(260 70% 60%)",
    "--chart-grid": "hsla(180 40% 60% / 0.1)",
    "--success": "hsl(160 70% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(14px)",
  },

  lavender: {
    "--bg": "hsl(260 30% 9%)",
    "--bg-muted": "hsl(260 25% 13%)",
    "--card": "hsla(260 50% 98% / 0.06)",
    "--card-border": "hsla(270 60% 65% / 0.18)",
    "--text": "hsl(260 40% 95%)",
    "--text-muted": "hsl(260 20% 62%)",
    "--accent": "hsl(270 70% 65%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(270 70% 65%)",
    "--shadow": "0 8px 32px hsla(270 50% 30% / 0.25)",
    "--glow": "0 0 20px hsla(270 70% 65% / 0.35)",
    "--chart-1": "hsl(270 70% 65%)",
    "--chart-2": "hsl(200 80% 60%)",
    "--chart-grid": "hsla(260 40% 70% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(14px)",
  },

  slate: {
    "--bg": "hsl(215 25% 9%)",
    "--bg-muted": "hsl(215 20% 13%)",
    "--card": "hsl(215 18% 16%)",
    "--card-border": "hsla(215 30% 50% / 0.15)",
    "--text": "hsl(210 25% 93%)",
    "--text-muted": "hsl(210 15% 55%)",
    "--accent": "hsl(215 75% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(215 75% 60%)",
    "--shadow": "0 6px 24px hsla(215 30% 10% / 0.4)",
    "--glow": "none",
    "--chart-1": "hsl(215 75% 60%)",
    "--chart-2": "hsl(175 60% 50%)",
    "--chart-grid": "hsla(215 20% 50% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  // ============================================================
  // WARM TONES - Cozy and energizing
  // ============================================================

  ember: {
    "--bg": "hsl(25 35% 7%)",
    "--bg-muted": "hsl(25 30% 11%)",
    "--card": "hsla(30 60% 95% / 0.06)",
    "--card-border": "hsla(35 90% 55% / 0.2)",
    "--text": "hsl(40 50% 95%)",
    "--text-muted": "hsl(35 25% 58%)",
    "--accent": "hsl(35 95% 55%)",
    "--accent-contrast": "hsl(25 40% 8%)",
    "--ring": "hsl(35 95% 55%)",
    "--shadow": "0 10px 36px hsla(35 80% 30% / 0.25)",
    "--glow": "0 0 22px hsla(35 95% 55% / 0.35)",
    "--chart-1": "hsl(35 95% 55%)",
    "--chart-2": "hsl(200 80% 55%)",
    "--chart-grid": "hsla(35 50% 60% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(45 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(14px)",
  },

  crimson: {
    "--bg": "hsl(350 35% 6%)",
    "--bg-muted": "hsl(350 30% 10%)",
    "--card": "hsla(0 60% 95% / 0.05)",
    "--card-border": "hsla(350 80% 55% / 0.2)",
    "--text": "hsl(0 30% 95%)",
    "--text-muted": "hsl(350 15% 58%)",
    "--accent": "hsl(350 85% 55%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(350 85% 55%)",
    "--shadow": "0 10px 36px hsla(350 70% 25% / 0.3)",
    "--glow": "0 0 24px hsla(350 85% 55% / 0.4)",
    "--chart-1": "hsl(350 85% 55%)",
    "--chart-2": "hsl(200 80% 55%)",
    "--chart-grid": "hsla(350 40% 60% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(350 85% 55%)",
    "--card-backdrop": "blur(14px)",
  },

  forest: {
    "--bg": "hsl(140 35% 6%)",
    "--bg-muted": "hsl(140 30% 10%)",
    "--card": "hsla(130 50% 95% / 0.05)",
    "--card-border": "hsla(145 65% 45% / 0.18)",
    "--text": "hsl(130 30% 94%)",
    "--text-muted": "hsl(130 15% 55%)",
    "--accent": "hsl(145 70% 45%)",
    "--accent-contrast": "hsl(140 40% 8%)",
    "--ring": "hsl(145 70% 45%)",
    "--shadow": "0 8px 32px hsla(140 50% 20% / 0.25)",
    "--glow": "0 0 20px hsla(145 70% 45% / 0.3)",
    "--chart-1": "hsl(145 70% 45%)",
    "--chart-2": "hsl(40 80% 50%)",
    "--chart-grid": "hsla(140 30% 50% / 0.1)",
    "--success": "hsl(145 70% 45%)",
    "--warning": "hsl(45 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(12px)",
  },

  coffee: {
    "--bg": "hsl(25 25% 8%)",
    "--bg-muted": "hsl(25 20% 12%)",
    "--card": "hsl(25 18% 15%)",
    "--card-border": "hsla(30 40% 45% / 0.18)",
    "--text": "hsl(35 35% 92%)",
    "--text-muted": "hsl(30 15% 55%)",
    "--accent": "hsl(30 60% 50%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(30 60% 50%)",
    "--shadow": "0 6px 24px hsla(25 30% 10% / 0.4)",
    "--glow": "none",
    "--chart-1": "hsl(30 60% 50%)",
    "--chart-2": "hsl(185 60% 45%)",
    "--chart-grid": "hsla(30 20% 50% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(45 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  // ============================================================
  // MINIMAL / CLEAN - Simple and elegant
  // ============================================================

  paper: {
    "--bg": "hsl(220 15% 14%)",
    "--bg-muted": "hsl(220 12% 18%)",
    "--card": "hsl(220 10% 20%)",
    "--card-border": "hsla(220 20% 50% / 0.12)",
    "--text": "hsl(0 0% 92%)",
    "--text-muted": "hsl(220 10% 58%)",
    "--accent": "hsl(220 70% 55%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(220 70% 55%)",
    "--shadow": "0 4px 16px hsla(0 0% 0% / 0.2)",
    "--glow": "none",
    "--chart-1": "hsl(220 70% 55%)",
    "--chart-2": "hsl(150 60% 45%)",
    "--chart-grid": "hsla(220 15% 50% / 0.08)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "none",
  },

  mono: {
    "--bg": "hsl(0 0% 6%)",
    "--bg-muted": "hsl(0 0% 10%)",
    "--card": "hsl(0 0% 12%)",
    "--card-border": "hsla(0 0% 100% / 0.08)",
    "--text": "hsl(0 0% 92%)",
    "--text-muted": "hsl(0 0% 55%)",
    "--accent": "hsl(0 0% 80%)",
    "--accent-contrast": "hsl(0 0% 6%)",
    "--ring": "hsl(0 0% 80%)",
    "--shadow": "0 4px 16px hsla(0 0% 0% / 0.4)",
    "--glow": "none",
    "--chart-1": "hsl(0 0% 70%)",
    "--chart-2": "hsl(0 0% 50%)",
    "--chart-grid": "hsla(0 0% 100% / 0.06)",
    "--success": "hsl(0 0% 70%)",
    "--warning": "hsl(0 0% 60%)",
    "--danger": "hsl(0 0% 50%)",
    "--card-backdrop": "none",
  },

  // ============================================================
  // CUSTOM - User customizable placeholder
  // ============================================================

  custom: {
    "--bg": "hsl(222 47% 6%)",
    "--bg-muted": "hsl(222 40% 9%)",
    "--card": "hsla(220 50% 98% / 0.05)",
    "--card-border": "hsla(220 60% 60% / 0.15)",
    "--text": "hsl(210 40% 96%)",
    "--text-muted": "hsl(215 20% 65%)",
    "--accent": "hsl(217 91% 60%)",
    "--accent-contrast": "hsl(0 0% 100%)",
    "--ring": "hsl(217 91% 60%)",
    "--shadow": "0 8px 32px hsla(220 80% 10% / 0.5)",
    "--glow": "0 0 20px hsla(217 91% 60% / 0.3)",
    "--chart-1": "hsl(217 91% 60%)",
    "--chart-2": "hsl(280 70% 65%)",
    "--chart-grid": "hsla(220 30% 80% / 0.1)",
    "--success": "hsl(152 69% 45%)",
    "--warning": "hsl(38 92% 50%)",
    "--danger": "hsl(0 84% 60%)",
    "--card-backdrop": "blur(12px)",
  },
};

// Theme metadata for better UX in the selector
export const THEME_META: Record<ThemeKey, { category: string; description: string }> = {
  midnight: { category: "Dark", description: "Clean dark blue" },
  obsidian: { category: "Dark", description: "Deep black with blue" },
  charcoal: { category: "Dark", description: "Warm dark gray" },
  amoled: { category: "OLED", description: "Pure black" },
  "amoled-cyan": { category: "OLED", description: "Black + cyan" },
  "amoled-purple": { category: "OLED", description: "Black + purple" },
  "amoled-rose": { category: "OLED", description: "Black + rose" },
  "electric-blue": { category: "Neon", description: "Vibrant blue" },
  "cyber-pink": { category: "Neon", description: "Hot pink" },
  "neon-mint": { category: "Neon", description: "Fresh mint" },
  sunset: { category: "Neon", description: "Orange to pink" },
  aurora: { category: "Neon", description: "Northern lights" },
  arctic: { category: "Cool", description: "Icy blue" },
  ocean: { category: "Cool", description: "Deep sea teal" },
  lavender: { category: "Cool", description: "Soft purple" },
  slate: { category: "Cool", description: "Professional gray" },
  ember: { category: "Warm", description: "Warm amber" },
  crimson: { category: "Warm", description: "Deep red" },
  forest: { category: "Warm", description: "Natural green" },
  coffee: { category: "Warm", description: "Rich brown" },
  paper: { category: "Minimal", description: "Clean & simple" },
  mono: { category: "Minimal", description: "Pure grayscale" },
  custom: { category: "Custom", description: "Your colors" },
};

// Ordered categories for display
export const THEME_CATEGORIES = ["Dark", "OLED", "Neon", "Cool", "Warm", "Minimal", "Custom"] as const;
