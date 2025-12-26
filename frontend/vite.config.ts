import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Force port 5173, fail if unavailable
    host: true, // Allow connections from all network interfaces (0.0.0.0)
    // This ensures the server is accessible from localhost
    hmr: {
      clientPort: 5173,
    },
    // Exclude large directories from file watching to speed up startup
    // This prevents Vite from scanning 2800+ SVG files in parent directories
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/backend/**',
        '**/math2visual_repo/**',
        '**/additional_icons/**',
        '**/cached_images/**',
        '**/venv/**',
        '**/__pycache__/**',
        '**/.git/**',
        '**/ITC-handbook-main/**',
        '../backend/**',
        '../math2visual_repo/**',
        '../additional_icons/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
