import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3001'

  // Câmera do celular exige HTTPS na rede local. A página HTTPS não pode chamar uma API
  // HTTP, por isso o Vite encaminha /api para a API e o navegador vê a mesma origem.
  const proxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(env.DEV_HTTPS === 'true' ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'logo.png'],
        manifest: {
          name: 'ColdChain Monitor',
          short_name: 'ColdChain',
          description: 'Monitoramento de temperatura da cadeia fria',
          lang: 'pt-BR',
          display: 'standalone',
          start_url: '/',
          theme_color: '#256abf',
          background_color: '#f9f9f7',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Dados de temperatura nunca vêm de cache: só a interface fica disponível offline
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { host: true, proxy },
    preview: { host: true, proxy },
  }
})
