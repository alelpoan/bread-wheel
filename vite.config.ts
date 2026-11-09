import { defineConfig } from 'vite'
import { midenVitePlugin } from '@miden-sdk/vite-plugin'

export default defineConfig({
  plugins: [
    midenVitePlugin({ crossOriginIsolation: true }),
  ],
})
