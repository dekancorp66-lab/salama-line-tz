import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/provider.tsx";

/**
 * Scrolling organization strip at the bottom of the hero.
 *
 * HOW TO ADD A LOGO
 *   Run  node scripts/fetch-logos.mjs  to download them, or save a logo in
 *   public/partners/  with the file name shown below (.svg .png .jpg .webp).
 *   A missing logo falls back to the organization's name.
 *
 * IMPORTANT: only add a logo with that organisation's permission.
 */
export const orgs: { name: string; file: string }[] = [
  { name: "signiAI", file: "signiai" },
  { name: "Tanzania Women Lawyers Association", file: "tawla" },
  { name: "Tanzania Media Women's Association", file: "tamwa" },
  { name: "Women's Legal Aid Centre", file: "wlac" },
  { name: "Msichana Initiative", file: "msichana" },
  { name: "Kivulini Women's Rights Organization", file: "kivulini" },
];

// Most partner logos are shipped as PNG; try it first so the normal case does
// not log avoidable 404s from probing SVG names that are not present.
const EXTS = ["png", "svg", "jpg", "webp"];

function Logo({ name, file }: { name: string; file: string }) {
  const [i, setI] = useState(0);
  const { t } = useI18n();
  if (i >= EXTS.length) {
    return (
      <li className="flex h-10 shrink-0 items-center px-1.5 md:h-11 md:px-2">
        <span
          role="img"
          aria-label={t("organizations.logoUnavailable", { name })}
          title={name}
          className="inline-flex max-w-40 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-sm sm:max-w-none sm:px-2.5"
        >
          <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-semibold text-white">
            {name.slice(0, 1)}
          </span>
          <span className="max-w-36 truncate sm:max-w-none">{name}</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex h-10 shrink-0 items-center px-1.5 md:h-11 md:px-2">
      <span className="grid h-9 w-24 place-items-center rounded-lg bg-white p-1.5 shadow-sm sm:w-28">
        <img
          src={`/partners/${file}.${EXTS[i]}`}
          alt={name}
          loading="lazy"
          onError={() => setI(i + 1)}
          className="h-6 w-auto max-w-16 object-contain"
        />
      </span>
    </li>
  );
}

// Repeated so the strip is always wider than the screen, even with few logos.
function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {[0, 1, 2].flatMap((r) => orgs.map((o) => <Logo key={`${r}-${o.file}`} {...o} />))}
    </ul>
  );
}

// Scroll speed in pixels per second. Raise it to go faster, lower to go slower.
const SPEED = 110;

export function LogoMarquee() {
  const track = useRef<HTMLDivElement>(null);

  // Keep the speed constant no matter how many logos are showing.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => {
      const half = el.scrollWidth / 2;
      if (half > 0) el.style.animationDuration = `${half / SPEED}s`;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="marquee relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
      }}
    >
      <div ref={track} className="marquee-track flex w-max">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
