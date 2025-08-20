import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "LiftLog",
        short_name: "LiftLog",
        description: "Track lifting sessions and measurements offline",
        theme_color: "#0b0f14",
        background_color: "#0b0f14",
        // Use absolute URLs so install works whether the manifest is served from /progress or /progress/dist/assets
        start_url: "/progress/dist/index.html",
        scope: "/progress/dist/",
        display: "standalone",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  // Use relative base so the app works from a subfolder like /progress
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react','react-dom','@supabase/supabase-js'
          ],
          charts: [
            'recharts'
          ]
        }
      }
    }
  }
});
