import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
            return 'vendor-react'
          }
          if (id.includes('@xyflow') || id.includes('@dagrejs')) return 'vendor-graph'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('html-to-image') || id.includes('purify')) {
            return 'vendor-export'
          }
          if (id.includes('lucide-react') || id.includes('react-countup') || id.includes('react-dropzone')) {
            return 'vendor-ui'
          }
          if (id.includes('axios')) return 'vendor-net'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
