import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Support modern features including top-level await
    minify: 'esbuild',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext', // Support top-level await in dependencies
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
