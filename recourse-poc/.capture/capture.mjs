import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const URLBASE = "http://localhost:5173";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const shot = async (name, full = true) => {
  await page.screenshot({ path: OUT + name + ".png", fullPage: full });
  console.log("shot", name);
};
const pause = (ms) => page.waitForTimeout(ms);

await page.goto(URLBASE, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Law Gun" }).waitFor();
await pause(400);
await shot("01-landing");

// Area → Housing & Tenancy
await page.locator(".case-card", { hasText: "Housing & Tenancy" }).first().click();
await pause(500);
await shot("02-subarea");

// Sub-area → Tenancy deposit return
await page.locator(".case-card", { hasText: "Tenancy deposit return" }).first().click();
await page.locator(".intake").waitFor();
await pause(400);

// Fill the sample_data (Watson) facts
await page.fill("#f-deposit-amount", "980.77");
await page.fill("#f-deposit-paidDate", "2024-04-13");
await page.fill("#f-tenancy-startDate", "2024-04-17");
const pickNo = async (labelText) =>
  page.locator(".field", { hasText: labelText }).getByText("No", { exact: true }).click();
await pickNo("Has the tenancy ended?");
await pickNo("Is your deposit protected");
await pickNo("prescribed information");
await page.fill("#f-landlord-name", "Mr Patrick James Sullivan");
await page.fill("#f-landlord-address", "28 Holyhead Road, Handsworth, Birmingham B21 0LJ");
await page.fill("#f-landlord-email", "patrick.sullivan58@hotmail.com");
await page.fill("#f-tenant-name", "Jamie Alexander Watson");
await page.fill("#f-property-address", "Flat 6, 14 Wellington Court, Edgbaston, Birmingham B16 9PJ");
await page.fill("#f-property-postcode", "B16 9PJ");
await pause(300);
await shot("03-intake");

// Submit → plan
await page.locator("button.primary-btn").click();
await page.locator(".next-move, .tool-card").first().waitFor();
await pause(600);
await shot("04-plan");

// Open the Letter Before Action tool
try {
  await page
    .locator(".tool-card", { has: page.locator(".tool-title", { hasText: "Send a Letter Before Action" }) })
    .first()
    .click();
  await page.locator(".tool-detail").waitFor({ timeout: 10000 });
  await pause(500);
  // wait for the grounding to finish (loading text disappears, letter renders)
  await page.locator(".letter").waitFor({ timeout: 30000 });
  await page.locator(".prov").first().waitFor({ timeout: 30000 });
  await pause(800);
  await shot("05-letter");

  // Open the provenance drawer on a verified sentence
  await page.locator(".prov").first().scrollIntoViewIfNeeded();
  await page.locator(".prov").first().click();
  await page.locator(".drawer").waitFor({ timeout: 8000 });
  await pause(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(200);
  await shot("06-drawer", false);
} catch (e) {
  console.log("letter/drawer step issue:", String(e).split("\n")[0]);
  await shot("05-letter-debug", false);
}

await browser.close();
console.log("done");
