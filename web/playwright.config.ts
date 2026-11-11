import { defineConfig, devices } from '@playwright/test'

const API_PORT = 3397
const WEB_PORT = 5199

// Sobe a API (../api) e o Vite em portas próprias. O broker aponta para uma
// porta sem serviço: os testes usam a rota HTTP e nada é publicado no broker do .env.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/alerts`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      env: { PORT: String(API_PORT), MQTT_BROKER_URL: 'mqtt://127.0.0.1:18899' },
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      timeout: 60_000,
    },
  ],
})
