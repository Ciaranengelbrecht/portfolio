import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'LiftLog',
        short_name: 'LiftLog',
        description: 'Track lifting sessions and measurements offline',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
  // Installed app will originate from /progress/dist; dist manifest uses ./index.html at that scope.
  start_url: './index.html',
  scope: './',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  // Use relative base so the app works from a subfolder like /progress
  base: './',
})
