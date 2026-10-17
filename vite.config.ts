import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawPort = env.VITE_PORT ?? '5173'
  const port = Number(rawPort)
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VITE_PORT must be an integer between 1 and 65535')
  }

  return {
    // Repository policy forbids batch deletion. Old build artifacts are left for manual cleanup.
    build: { emptyOutDir: false },
    server: {
      port,
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      vue(),
      // Keep the preview clear; opt in when actively inspecting Vue components.
      ...(env.VITE_DEVTOOLS === 'true' ? [vueDevTools()] : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
