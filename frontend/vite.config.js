import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@communication': path.resolve(__dirname, '../src/communication'),
      'idb': path.resolve(__dirname, '../tests/mock-idb.js'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

