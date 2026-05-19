import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.E2E_PORT ?? "3100")
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`
const useRealEnvironment = process.env.E2E_USE_REAL_ENV === "1"

const isolatedTestEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  OPENAI_API_KEY: "",
  NEXT_PUBLIC_APP_URL: baseURL,
  NEXT_PUBLIC_CARD_FEE_DEFAULT: "0.0299",
} satisfies Record<string, string>

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/e2e-results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  webServer: {
    command: `corepack.cmd pnpm dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: useRealEnvironment ? { NEXT_PUBLIC_APP_URL: baseURL } : isolatedTestEnvironment,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
})
