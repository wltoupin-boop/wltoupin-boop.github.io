import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/wltoupin-boop.github.io/',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
