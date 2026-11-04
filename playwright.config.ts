import { defineConfig, devices } from '@playwright/test'

// Parcours principaux sur mobile, contre le Supabase local (npm run db:start).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', locale: 'fr-FR' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'npx vite --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
})
