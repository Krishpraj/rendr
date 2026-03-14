import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        // Polyfill Node.js modules for @gltf-transform/core NodeIO (same as webpack fallback: false)
        'fs': resolve('src/renderer/src/lib/empty-module.ts'),
        'fs/promises': resolve('src/renderer/src/lib/empty-module.ts'),
        'path': resolve('src/renderer/src/lib/empty-module.ts'),
        'module': resolve('src/renderer/src/lib/empty-module.ts')
      }
    },
    plugins: [react()],
    css: {
      postcss: resolve(__dirname, 'postcss.config.js')
    },
    assetsInclude: ['**/*.wasm']
  }
})
