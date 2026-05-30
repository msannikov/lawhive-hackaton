import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const URLBASE = "http://localhost:5173";
const SAMPLE = "/Users/petr.leontev/lawhive_hackathon/lawhive-hackaton/sample_data/";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const shot = async (name, full = true) => {
  await page.screenshot({ path: OUT + name + ".png", fullPage: full });
  console.log("shot", name);
};
const pause = (ms) => page.waitForTimeout(ms);
const pickNo = async (labelText) =>
  page.locator(".field", { hasText: labelText }).getByText("No", { exact: true }).click();
const ensure = async (sel, val) => {
  const v = await page.inputValue(sel).catch(() => "");
  if (!v) await page.fill(sel, val);
};

await page.goto(URLBASE, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Law Gun" }).waitFor();
await pause(400);
await shot("01-landing");

await page.locator(".case-card", { hasText: "Housing & Tenancy" }).first().click();
await pause(500);
await shot("02-subarea");

await page.locator(".case-card", { hasText: "Tenancy deposit return" }).first().click();
await page.locator(".intake").waitFor();
await pause(400);

// Hero flow: upload the real sample_data documents → Law Gun reads & prefills
try {
  await page.setInputFiles("#doc-upload", [
    SAMPLE + "tenancy_agreement.pdf",
    SAMPLE + "bank_statement_deposit_payment.pdf",
    SAMPLE + "dps_search_result.png",
    SAMPLE + "mydeposits_search_result.png",
    SAMPLE + "tds_search_result.png",
  ]);
  await page.locator(".uploader-msg").filter({ hasText: "Read" }).waitFor({ timeout: 50000 });
  await pause(700);
} catch (e) {
  console.log("upload prefill skipped:", String(e).split("\n")[0]);
}

// Safety net — make sure the required fields are populated for submit.
await ensure("#f-deposit-amount", "980.77");
await ensure("#f-deposit-paidDate", "2024-04-13");
await ensure("#f-tenancy-startDate", "2024-04-17");
await ensure("#f-landlord-name", "Mr Patrick James Sullivan");
await ensure("#f-tenant-name", "Jamie Alexander Watson");
await ensure("#f-property-address", "Flat 6, 14 Wellington Court, Edgbaston, Birmingham B16 9PJ");
try { await pickNo("Is your deposit protected"); } catch {}
try { await pickNo("prescribed information"); } catch {}

await page.evaluate(() => window.scrollTo(0, 0));
await pause(400);
await shot("03-intake", false); // viewport — prominent uploader + top of form

// Submit → plan
await page.locator("button.primary-btn").click();
await page.locator(".next-move, .tool-card").first().waitFor();
await pause(600);
await shot("04-plan");

// Open the Letter Before Action tool → grounded letter with inline citations
try {
  await page
    .locator(".tool-card", { has: page.locator(".tool-title", { hasText: "Send a Letter Before Action" }) })
    .first()
    .click();
  await page.locator(".tool-detail").waitFor({ timeout: 10000 });
  await page.locator(".letter").waitFor({ timeout: 35000 });
  await page.locator(".prov").first().waitFor({ timeout: 35000 });

  // Frame the body on the cited sentences so the (s.213(3)) refs are readable.
  await page.locator(".prov").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await pause(600);
  await shot("05-letter", false);

  // Open the provenance drawer on that verified sentence
  await page.locator(".prov").first().click();
  await page.locator(".drawer").waitFor({ timeout: 8000 });
  await pause(500);
  await shot("06-drawer", false);
} catch (e) {
  console.log("letter/drawer step issue:", String(e).split("\n")[0]);
  await shot("05-letter-debug", false);
}

await browser.close();
console.log("done");
