import path from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://localhost:3000";
const outputDir = path.join(process.cwd(), "artifacts", "screenshots");
const prefix = process.argv[2] || "before";

async function save(page, name, options = {}) {
  await page.screenshot({
    path: path.join(outputDir, `${prefix}-${name}.png`),
    fullPage: true,
    ...options,
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });

await page.goto(baseUrl, { waitUntil: "networkidle" });
await save(page, "dashboard");

await page.goto(`${baseUrl}/projects/new`, { waitUntil: "networkidle" });
await save(page, "new-project");

await page.goto(`${baseUrl}/projects/project-orchard-ashes/voice`, { waitUntil: "networkidle" });
await save(page, "voice-setup");

await page.goto(`${baseUrl}/projects/project-tideglass-letters/manuscript`, {
  waitUntil: "networkidle",
});
await save(page, "manuscript-import");

await page.goto(`${baseUrl}/projects/project-quiet-lantern/studio`, {
  waitUntil: "networkidle",
});
await save(page, "studio-editor");

await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
await save(page, "settings");

await page.goto(`${baseUrl}/projects/project-quiet-lantern/export`, {
  waitUntil: "networkidle",
});
await save(page, "export");

await page.goto(`${baseUrl}/projects/new`, { waitUntil: "networkidle" });
await page.route(
  "**/api/projects",
  async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      project: {
        id: "loading-project",
      },
    }),
  });
  },
  { times: 1 },
);
await page.getByLabel("Project title").fill("Loading State Book");
await page.getByLabel("Author").fill("Review Runner");
await page.getByRole("button", { name: "Create project" }).click();
await page.waitForSelector("text=Creating project...", { timeout: 2000 });
await save(page, "loading-state");

await page.goto(`${baseUrl}/projects/project-tideglass-letters/studio`, {
  waitUntil: "networkidle",
});
await save(page, "generating-state");

await page.goto(`${baseUrl}/settings`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Save settings" }).click();
await page.waitForSelector("text=Settings saved", { timeout: 2000 });
await save(page, "success-state");

await page.goto(`${baseUrl}/projects/project-orchard-ashes/voice`, { waitUntil: "networkidle" });
await page.route(
  `**/api/projects/project-orchard-ashes/voice`,
  async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The local voice server is unavailable. Check the provider and try again.",
      }),
    });
  },
  { times: 1 },
);
await page.getByLabel("Voice profile name").fill("Failure Review Voice");
await page.getByRole("button", { name: "Save voice profile" }).click();
await page.waitForSelector("text=Voice setup failed", { timeout: 2000 });
await save(page, "failure-state");

await browser.close();
