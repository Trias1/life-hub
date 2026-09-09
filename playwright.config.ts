import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  reporter: "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000", headless: true },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm.cmd run dev", url: "http://127.0.0.1:3000/login", reuseExistingServer: true, timeout: 120000 },
})
