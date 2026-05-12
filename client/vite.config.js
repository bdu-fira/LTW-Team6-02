import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://dynamic-reanalyze-hankie.ngrok-free.dev',
        changeOrigin: true,
        secure: false,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      },
      '/socket.io': {
        target: 'https://dynamic-reanalyze-hankie.ngrok-free.dev',
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      },
    },
  },
})
