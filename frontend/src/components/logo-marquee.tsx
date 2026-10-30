import { useEffect, useRef, useState } from "react";

/**
 * Scrolling logo strip at the bottom of the hero (same idea as the
 * "Trusted by" row under the hero on papermark.com). Logos only, no names.
 *
 * HOW TO ADD A LOGO
 *   Run  node scripts/fetch-logos.mjs  to download them, or save a logo in
 *   public/partners/  with the file name shown below (.svg .png .jpg .webp).
 *   A logo whose file is missing simply does not appear, so the strip never
 *   shows broken images or names.
 *
 * IMPORTANT: only add a logo with that organisation's permission.
 */
export const orgs: { name: string; file: string }[] = [
  { name: "signiAI", file: "signiai" },
  { name: "Tanzania Women Lawyers Association", file: "tawla" },
  { name: "Tanzania Media Women's Association", file: "tamwa" },
  { name: "Women's Legal Aid Centre", file: "wlac" },
  { name: "Msichana Initiative", file: "msichana" },
  { name: "Tanzania Gender Networking Programme", file: "tgnp" },
  { name: "Kivulini Women's Rights Organization", file: "kivulini" },
  { name: "Children's Dignity Forum", file: "cdf" },
  { name: "Plan International Tanzania", file: "plan" },
  { name: "Equality Now", file: "equality-now" },
  { name: "Girls Not Brides", file: "girls-not-brides" },
];

const EXTS = ["svg", "png", "jpg", "webp"];

function Logo({ name, file }: { name: string; file: string }) {
  const [i, setI] = useState(0);
  if (i >= EXTS.length) return null;
  return (
    <li className="flex h-12 shrink-0 items-center px-7 md:h-14 md:px-10">
      <img
        src={`/partners/${file}.${EXTS[i]}`}
        alt={name}
        loading="lazy"
        onError={() => setI(i + 1)}
        className="h-9 w-auto max-w-[170px] object-contain opacity-70 brightness-0 invert md:h-11"
      />
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
