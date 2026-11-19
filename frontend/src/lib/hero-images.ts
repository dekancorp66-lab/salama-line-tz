/**
 * Runtime-loaded hero slideshow configuration.
 *
 * Photos are deliberately not compiled into the bundle: changing or adding an
 * image only means updating the manifest (or the URL it points to), and the
 * next page load / refresh picks it up. Every request is cache-busted so a
 * replaced file cannot stay stuck in the browser cache.
 */

export interface HeroImage {
  src: string;
  alt: string;
  focus: string;
}

export const HERO_IMAGES_REFRESH_EVENT = "salamaline:refresh-hero-images";

const DEFAULT_MANIFEST_URL = "/image/home%20/manifest.json";

// Used only if the manifest cannot be fetched (offline preview, broken JSON).
const FALLBACK: HeroImage[] = [
  { src: "/image/home%20/Maasai%20women.jpeg", alt: "", focus: "center 30%" },
  { src: "/image/home%20/smile%20Africa.jpeg", alt: "", focus: "center 35%" },
  { src: "/image/home%20/776800635702047275.jpeg", alt: "", focus: "center 30%" },
  { src: "/image/home%20/_%20%282%29.jpeg", alt: "", focus: "center 25%" },
  { src: "/image/home%20/%F0%9F%92%99%F0%9F%92%99%F0%9F%92%99.jpeg", alt: "", focus: "center 25%" },
];

function manifestUrl(bust: boolean): string {
  const configured = import.meta.env.VITE_HERO_IMAGES_URL as string | undefined;
  const base = configured?.trim() || DEFAULT_MANIFEST_URL;
  return bust ? `${base}${base.includes("?") ? "&" : "?"}v=${Date.now()}` : base;
}

/** Encode a manifest path so spaces, emoji and ampersands become safe URLs. */
function safeSrc(src: string): string {
  return encodeURI(src.trim());
}

function parseManifest(value: unknown, version: string): HeroImage[] {
  if (!value || typeof value !== "object") return [];
  const images = (value as { images?: unknown }).images;
  if (!Array.isArray(images)) return [];
  const stamp = encodeURIComponent(version || String(Date.now()));
  return images
    .filter(
      (item): item is { src: string; alt?: unknown; focus?: unknown } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { src?: unknown }).src === "string",
    )
    .map((item) => {
      const src = safeSrc(item.src);
      if (!/^(https?:\/\/|\/)/i.test(src)) return null;
      return {
        src: `${src}${src.includes("?") ? "&" : "?"}v=${stamp}`,
        alt: typeof item.alt === "string" ? item.alt : "",
        focus: typeof item.focus === "string" && item.focus ? item.focus : "center 30%",
      } satisfies HeroImage;
    })
    .filter((item): item is HeroImage => item !== null);
}

/**
 * Fetch the photo list from the website. `force` adds a timestamp so both the
 * manifest and the images are re-requested when an editor has changed them.
 */
export async function loadHeroImages(force = false): Promise<HeroImage[]> {
  try {
    const response = await fetch(manifestUrl(force), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return FALLBACK;
    const body: unknown = await response.json();
    const version =
      body && typeof body === "object" && typeof (body as { version?: unknown }).version === "string"
        ? (body as { version: string }).version
        : "";
    const images = parseManifest(body, force ? `${version || "v"}-${Date.now()}` : version);
    return images.length ? images : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/** Ask every mounted slideshow to reload the manifest from the website. */
export function refreshHeroImages(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HERO_IMAGES_REFRESH_EVENT));
}
