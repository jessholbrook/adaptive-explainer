// Capture marketing screenshots of the deployed app.
// One-time setup: npm i -D playwright && npx playwright install chromium
// Run with: node scripts/screenshots.mjs
// Outputs PNG files to docs/screenshots/.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "docs", "screenshots");
const URL = process.env.URL ?? "https://adaptive-explainer.vercel.app";
const TOPIC = process.env.TOPIC ?? "How does HTTPS work?";
// shadcn/Base UI Select is not a native <select> — pick by visible label.
const MODEL_LABEL = process.env.MODEL_LABEL ?? "Claude Haiku 4.5";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina-ish for crisper output
  });
  const page = await context.newPage();

  console.log(`→ ${URL}`);
  await page.goto(URL, { waitUntil: "networkidle" });

  // 1) Landing page
  await page.screenshot({
    path: path.join(OUT_DIR, "01-landing.png"),
    fullPage: false,
  });
  console.log("✓ 01-landing.png");

  // 2) Enter a topic and pick a model (Base UI Select: click trigger → option)
  await page.fill("#topic", TOPIC);
  await page.click("#model");
  await page.getByRole("option", { name: MODEL_LABEL, exact: true }).click();
  await page.click('button:has-text("Start Learning")');

  // Wait for the lesson view to render — the "Got it" button appears after the
  // explanation lands. Pad timeout because LLM responses can take 10-20s.
  await page.waitForSelector('button:has-text("Got it")', { timeout: 60_000 });
  await page.waitForTimeout(800); // small settle for animations

  // 3) Lesson view
  await page.screenshot({
    path: path.join(OUT_DIR, "02-lesson.png"),
    fullPage: false,
  });
  console.log("✓ 02-lesson.png");

  // 4) Ask a question to populate the model panel, then capture again
  await page.fill(
    'input[placeholder*="question" i]',
    "Whats the difference between SSL and TLS?",
  );
  await page.click('button:has-text("Ask")');
  // Wait until the asking state ends — Ask button label returns to "Ask"
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Ask" || b.textContent?.trim() === "Asking…",
      );
      return btn && btn.textContent?.trim() === "Ask";
    },
    { timeout: 60_000 },
  );
  await page.waitForTimeout(800);

  await page.screenshot({
    path: path.join(OUT_DIR, "03-question.png"),
    fullPage: false,
  });
  console.log("✓ 03-question.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
