import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/postcss'

const rendererRoot = resolve(__dirname, 'src/renderer')

export default defineConfig({
  root: rendererRoot,
  base: './',
  publicDir: resolve(__dirname, 'public'),
  plugins: [react(), tsconfigPaths({ projects: [resolve(__dirname, 'tsconfig.json')] })],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@renderer': resolve(rendererRoot, 'src'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(rendererRoot, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: false,
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
  },
})
