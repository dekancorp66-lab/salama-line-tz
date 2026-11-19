#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8080";
const outDir = new URL("../screenshots/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const routes = [
  { path: "/", text: "Your new safety line" },
  { path: "/help", text: "Omba msaada" },
  { path: "/officers", text: "Sign in to your officer account" },
  { path: "/ai", text: "Msaidizi wa SalamaLine" },
];
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER_CHANNEL || "chrome" });
const results = [];
for (const viewport of viewports) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const errors = [];
    const notFound = [];
    page.on("response", (response) => { if (response.status() === 404) notFound.push(response.url()); });
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      // Partner logos intentionally probe four extensions before falling back
      // to the organisation name, so those 404s are expected by design.
      if (text.startsWith("Failed to load resource")) return;
      // Pre-existing simulator/server caret-style mismatch on the landing page.
      if (text.includes("A tree hydrated but some attributes")) return;
      errors.push(text);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const response = await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.getByText(route.text).first().waitFor({ timeout: 15000 });
      const bodyText = await page.locator("body").innerText();
      const hasText = bodyText.includes(route.text);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      const file = new URL(`${route.path === "/" ? "home" : route.path.slice(1)}-${viewport.name}.png`, outDir);
      await page.screenshot({ path: file.pathname, fullPage: false });
      const unexpectedNotFound = notFound.filter((url) => !url.includes("/partners/"));
      results.push({ viewport: viewport.name, path: route.path, status: response?.status(), hasText, overflow, errors, unexpectedNotFound, expectedLogoFallbacks: notFound.length });
    } catch (error) {
      results.push({ viewport: viewport.name, path: route.path, error: error.message, errors });
    }
    await page.close();
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.error || !item.hasText || item.overflow || item.errors?.length || item.unexpectedNotFound?.length)) process.exit(1);
