import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://troubled-ilse-dnl-b07c8b63.koyeb.app',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'https://troubled-ilse-dnl-b07c8b63.koyeb.app',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
