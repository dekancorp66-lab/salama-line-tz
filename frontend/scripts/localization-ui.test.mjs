import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS_DIR = join(FRONTEND_ROOT, "screenshots");
const VERDICT_PATH = join(SHOTS_DIR, "localization-verdict.json");
const BASE_URL = (process.env.LOCALIZATION_QA_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const STORAGE_KEY = "salama-line.language";

const PUBLIC_ROUTES = [
  { path: "/", en: "A safe place to ask for help", sw: "Sehemu salama ya kuomba msaada" },
  { path: "/help", en: "Get Help", sw: "Pata Msaada" },
  { path: "/ai", en: "AI Assistance", sw: "AI Assistance" },
  { path: "/services", en: "Verified Services", sw: "Huduma Zilizothibitishwa" },
  { path: "/track", en: "Track My Request", sw: "Fuatilia Ombi Langu" },
];

function recordError(bucket, message) {
  bucket.push(String(message || "unknown error"));
}

async function isServerUp() {
  try {
    // Dev SSR can take several seconds under CPU load; a short probe would
    // falsely skip the whole QA run.
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(30_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function switchLanguage(page, code) {
  const group = page.getByRole("group", { name: /language|lugha/i }).first();
  await group.getByRole("button", { name: code, exact: true }).click();
  await page.waitForTimeout(250);
}

async function languageState(page) {
  return page.evaluate((key) => ({
    htmlLang: document.documentElement.getAttribute("lang"),
    stored: localStorage.getItem(key),
  }), STORAGE_KEY);
}

async function bodyText(page) {
  return page.locator("body").innerText();
}

async function launchBrowser(t) {
  const base = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      // Headless Chrome on macOS can fail to initialise EGL/GPU and kill the
      // browser as soon as a page opens; force a pure software renderer.
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--use-gl=swiftshader",
      "--use-angle=swiftshader",
    ],
  };
  // An explicit channel always wins (local QA against an installed Chrome).
  if (process.env.LOCALIZATION_QA_CHANNEL) {
    return chromium.launch({ ...base, channel: process.env.LOCALIZATION_QA_CHANNEL });
  }
  // Playwright's pinned Chromium is optional. Exported projects may land on a
  // host where only a system Chrome/Edge is installed, so fall back to those
  // before skipping instead of failing the whole suite on a missing download.
  const candidates = [{}, { channel: "chrome" }, { channel: "msedge" }];
  const failures = [];
  for (const candidate of candidates) {
    try {
      return await chromium.launch({ ...base, ...candidate });
    } catch (error) {
      failures.push(`${candidate.channel ?? "bundled"}: ${String(error?.message ?? error).split("\n")[0]}`);
    }
  }
  return t.skip(`no usable Playwright browser (${failures.join(" | ")})`);
}

test("bilingual web UI switches, persists, and fits mobile viewports", async (t) => {
  if (!(await isServerUp())) {
    t.skip(`frontend is not serving at ${BASE_URL}; set LOCALIZATION_QA_BASE_URL to an active server`);
    return;
  }

  mkdirSync(SHOTS_DIR, { recursive: true });
  const consoleErrors = [];
  const pageErrors = [];
  const overflow = [];
  const browser = await launchBrowser(t);
  if (!browser) return;

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.clearCookies();
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);
    page.on("console", (message) => {
      if (message.type() === "error") recordError(consoleErrors, message.text());
    });
    page.on("pageerror", (error) => recordError(pageErrors, error?.message));

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    // TanStack hydration is asynchronous; clicking before it finishes silently
    // does nothing. Give React a moment to attach handlers after assets settle.
    await page.waitForTimeout(1_500);

    assert.match(await bodyText(page), /Get Help/, "first visit must default to English");
    let state = await languageState(page);
    assert.equal(state.htmlLang, "en");
    assert.ok(
      state.stored === null || state.stored === "en",
      "a first visit must start in English, with no non-English preference stored",
    );
    await page.screenshot({ path: join(SHOTS_DIR, "localization-home-en.png"), fullPage: false });

    await switchLanguage(page, "SW");
    assert.match(await bodyText(page), /Pata Msaada/);
    assert.match(await bodyText(page), /Sehemu salama ya kuomba msaada/);
    state = await languageState(page);
    assert.equal(state.htmlLang, "sw-TZ");
    assert.equal(state.stored, "sw");
    await page.screenshot({ path: join(SHOTS_DIR, "localization-home-sw.png"), fullPage: false });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1_200);
    assert.match(await bodyText(page), /Pata Msaada/, "Kiswahili must survive a reload");
    state = await languageState(page);
    assert.equal(state.htmlLang, "sw-TZ");
    assert.equal(state.stored, "sw");

    for (const route of PUBLIC_ROUTES.slice(1)) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      assert.match(await bodyText(page), new RegExp(route.sw), `${route.path} missing Kiswahili copy`);
      assert.equal((await languageState(page)).htmlLang, "sw-TZ");
    }

    await page.goto(`${BASE_URL}/institutions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    assert.match(await bodyText(page), /Ingia kwenye lango la taasisi/);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of PUBLIC_ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      overflow.push({ language: "sw", path: route.path, ...metrics });
      assert.ok(
        metrics.scrollWidth <= metrics.innerWidth + 1,
        `${route.path} overflows horizontally in Kiswahili mobile layout`,
      );
    }
    await page.goto(`${BASE_URL}/institutions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const institutionsMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    overflow.push({ language: "sw", path: "/institutions", ...institutionsMetrics });
    assert.ok(
      institutionsMetrics.scrollWidth <= institutionsMetrics.innerWidth + 1,
      "/institutions overflows horizontally in Kiswahili mobile layout",
    );
    await page.screenshot({ path: join(SHOTS_DIR, "localization-institutions-sw-mobile.png"), fullPage: false });

    await switchLanguage(page, "EN");
    state = await languageState(page);
    assert.equal(state.htmlLang, "en");
    assert.equal(state.stored, "en");
    for (const route of PUBLIC_ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      assert.match(await bodyText(page), new RegExp(route.en), `${route.path} missing English copy`);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      overflow.push({ language: "en", path: route.path, ...metrics });
      assert.ok(
        metrics.scrollWidth <= metrics.innerWidth + 1,
        `${route.path} overflows horizontally in English mobile layout`,
      );
    }
    await page.goto(`${BASE_URL}/institutions`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    assert.match(await bodyText(page), /Sign in to the institutional portal/);
    const institutionsEnMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    overflow.push({ language: "en", path: "/institutions", ...institutionsEnMetrics });
    assert.ok(
      institutionsEnMetrics.scrollWidth <= institutionsEnMetrics.innerWidth + 1,
      "/institutions overflows horizontally in English mobile layout",
    );

    assert.deepEqual(consoleErrors, [], "browser console contains errors");
    assert.deepEqual(pageErrors, [], "browser page errors were observed");

    writeFileSync(VERDICT_PATH, JSON.stringify({
      ok: true,
      baseUrl: BASE_URL,
      checks: {
        defaultEnglish: true,
        switchToKiswahili: true,
        reloadPersistence: true,
        publicRoutes: PUBLIC_ROUTES.map((route) => route.path),
        institutionalPortal: true,
        mobileOverflow: overflow,
      },
      consoleErrors,
      pageErrors,
    }, null, 2));
  } catch (error) {
    writeFileSync(VERDICT_PATH, JSON.stringify({
      ok: false,
      baseUrl: BASE_URL,
      error: String(error?.message || error),
      consoleErrors,
      pageErrors,
      mobileOverflow: overflow,
    }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
});
