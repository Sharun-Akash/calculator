import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      manifest: {
        name: 'Entry Calculator',
        short_name: 'Calculator',
        theme_color: '#1e293b',
        background_color: '#f3f4f6',
        display: 'standalone',
      }
    })
  ],
})