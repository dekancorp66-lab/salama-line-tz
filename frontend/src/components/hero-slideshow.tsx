import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/i18n/provider.tsx";
import {
  HERO_IMAGES_REFRESH_EVENT,
  loadHeroImages,
  type HeroImage,
} from "@/lib/hero-images.ts";

/**
 * Crossfading hero photos. The list comes from a runtime manifest, so editors
 * can add or replace pictures on the site without a code change or rebuild.
 */
export function HeroSlideshow() {
  const { t } = useI18n();
  const [images, setImages] = useState<HeroImage[]>([]);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async (force: boolean, announce = false) => {
    setRefreshing(true);
    const next = await loadHeroImages(force);
    setImages(next);
    setIndex((current) => (current >= next.length ? 0 : current));
    setRefreshing(false);
    if (announce) setStatus(t(force ? "home.photosRefreshed" : "home.photosRefreshFailed"));
  }, [t]);

  useEffect(() => {
    void load(false);
    const onFocus = () => void load(false);
    const onVisible = () => { if (document.visibilityState === "visible") void load(false); };
    const onRefresh = () => void load(true, true);
    window.addEventListener("focus", onFocus);
    window.addEventListener(HERO_IMAGES_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(HERO_IMAGES_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    images.forEach((image) => {
      const preload = new window.Image();
      preload.decoding = "async";
      preload.src = image.src;
    });
  }, [images]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion || images.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [reduceMotion, images.length]);

  const active = images.length ? index % images.length : 0;

  return (
    <>
      <div className="absolute inset-0 -z-20 overflow-hidden bg-neutral-950" aria-hidden="true">
        {images.map((image, i) => (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out motion-reduce:duration-0 ${
              i === (reduceMotion ? 0 : active) ? "opacity-100" : "opacity-0"
            }`}
            style={{ objectPosition: image.focus }}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            draggable={false}
            onError={() => setImages((current) => current.filter((item) => item.src !== image.src))}
          />
        ))}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{status}</span>
      <button
        type="button"
        aria-label={t("home.refreshPhotos")}
        title={t("home.refreshPhotos")}
        onClick={() => void load(true, true)}
        disabled={refreshing}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-black/25 text-white/80 backdrop-blur-sm transition hover:bg-white/15 hover:text-white disabled:opacity-50"
      >
        <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
      </button>
    </>
  );
}
