import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://web-du-lich-4pjb.onrender.com',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'https://web-du-lich-4pjb.onrender.com',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
