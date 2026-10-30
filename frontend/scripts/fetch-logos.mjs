#!/usr/bin/env node
/**
 * Downloads each organisation's logo from its own website into public/partners/.
 *
 *   node scripts/fetch-logos.mjs          (skips logos you already have)
 *   node scripts/fetch-logos.mjs --force  (re-download everything)
 *
 * It opens each site's home page and picks the first image that looks like the
 * logo (an <img> whose src/alt/class mentions "logo", else the apple-touch-icon,
 * else og:image, else the favicon). Check the results: if one is wrong or
 * missing, save the right file by hand as public/partners/<file>.svg or .png.
 * Fix a wrong site address below if the script reports it can't reach one.
 * Only use a logo with that organisation's permission.
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const sites = [
  { file: "tawla", url: "https://tawla.or.tz" },
  { file: "tamwa", url: "https://tamwa.org" },
  { file: "wlac", url: "https://wlac.or.tz" },
  { file: "msichana", url: "https://msichanainitiative.org" },
  { file: "tgnp", url: "https://tgnp.org" },
  { file: "kivulini", url: "https://kivulini.or.tz" },
  { file: "cdf", url: "https://cdftz.org" },
  { file: "plan", url: "https://plan-international.org/tanzania" },
  { file: "equality-now", url: "https://equalitynow.org" },
  { file: "girls-not-brides", url: "https://www.girlsnotbrides.org" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const attr = (tag, name) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];

export function candidates(html, base) {
  const out = [];
  const abs = (u) => {
    try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return null; }
  };
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    const hay = `${src} ${attr(tag, "alt")} ${attr(tag, "class")} ${attr(tag, "id")}`;
    if (src && /logo/i.test(hay) && !src.startsWith("data:")) out.push(abs(src));
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/apple-touch-icon/i.test(tag)) out.push(abs(attr(tag, "href") ?? ""));
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (/og:image/i.test(tag)) out.push(abs(attr(tag, "content") ?? ""));
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/rel=["'][^"']*icon/i.test(tag)) out.push(abs(attr(tag, "href") ?? ""));
  }
  return [...new Set(out.filter(Boolean))];
}

const extFor = (type, url) => {
  if (/svg/.test(type) || /\.svg(\?|$)/i.test(url)) return "svg";
  if (/png/.test(type) || /\.png(\?|$)/i.test(url)) return "png";
  if (/jpe?g/.test(type) || /\.jpe?g(\?|$)/i.test(url)) return "jpg";
  if (/webp/.test(type) || /\.webp(\?|$)/i.test(url)) return "webp";
  return null;
};

async function get(url) {
  return fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000), redirect: "follow" });
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "partners");
  mkdirSync(root, { recursive: true });
  const force = process.argv.includes("--force");
  const list = process.env.LOGO_SITES ? JSON.parse(process.env.LOGO_SITES) : sites;
  for (const { file, url } of list) {
    if (!force && ["svg", "png", "jpg", "webp"].some((e) => existsSync(join(root, `${file}.${e}`)))) {
      console.log(`skip   ${file} (already have it)`);
      continue;
    }
    try {
      const page = await get(url);
      const html = await page.text();
      let saved = false;
      for (const c of candidates(html, page.url).slice(0, 8)) {
        try {
          const r = await get(c);
          if (!r.ok) continue;
          const ext = extFor(r.headers.get("content-type") ?? "", c);
          if (!ext) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 300) continue;
          writeFileSync(join(root, `${file}.${ext}`), buf);
          console.log(`ok     ${file}.${ext}  <-  ${c}`);
          saved = true;
          break;
        } catch {}
      }
      if (!saved) console.log(`MISSING ${file}: no logo found on ${url} - add it by hand`);
    } catch (e) {
      console.log(`FAILED ${file}: could not open ${url} (${e.cause?.code ?? e.message}) - check the address`);
    }
  }
}
main();
