import { defineConfig, devices } from "@playwright/test";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "Wage-Arrears-Calculator";
const basePath = process.env.GITHUB_PAGES === "true" ? `/${repositoryName}` : "";

export default defineConfig({
  testDir:"./tests/e2e",
  fullyParallel:true,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI ? 2 : 0,
  workers:process.env.CI ? 1 : undefined,
  reporter:process.env.CI ? [["list"], ["html", { open:"never" }]] : "list",
  use:{
    baseURL:`http://127.0.0.1:3100${basePath}`,
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
  },
  projects:[{
    name:"chromium",
    use:{...devices["Desktop Chrome"]},
  }],
  webServer:{
    command:"npm run dev -- --host 0.0.0.0 --port 3100",
    url:`http://127.0.0.1:3100${basePath}/`,
    reuseExistingServer:!process.env.CI,
    timeout:120_000,
  },
});
