import type { Core } from "./core.ts";

/** A count below `min` is hidden so no individual can be singled out. */
export type Cell = number | "<5";

export function suppress<T extends { count: number }>(rows: T[], min: number) {
  let hidden = false;
  const out: Array<Omit<T, "count"> & { count: Cell }> = rows.map((r) => {
    if (r.count < min) { hidden = true; return { ...r, count: `<${min}` as Cell }; }
    return { ...r, count: r.count as Cell };
  });
  // Publishing a total next to a hidden cell lets anyone subtract and recover it.
  const total = hidden ? null : rows.reduce((a, r) => a + r.count, 0);
  return { rows: out, total };
}

function group(rows: { count: number }[], key: (r: any) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.count);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Anonymous, aggregated partner view. Nothing here maps back to a person. */
export async function partnerStats(core: Core) {
  const min = core.cfg.minCell;
  const rows = await core.store.counters();
  const cases = await core.store.listCases();
  const answered = cases.filter((c) => c.acceptedAt);
  const mins = answered.map((c) => (c.acceptedAt! - c.createdAt) / 60_000).sort((a, b) => a - b);
  const median = mins.length ? mins[Math.floor(mins.length / 2)] : null;
  const within30 = answered.filter((c) => c.acceptedAt! - c.createdAt <= 30 * 60_000).length;

  const byDistrict = group(rows.filter((r) => r.district !== "-"), (r) => core.districtName(r.district));
  return {
    generatedAt: new Date(core.d.now()).toISOString(),
    minCell: min,
    byEvent: suppress(group(rows, (r) => r.event), min),
    byChannel: suppress(group(rows, (r) => r.channel), min),
    byDistrict: suppress(byDistrict, min),
    // Response speed is only shown once there is enough volume to be anonymous.
    response: cases.length >= min
      ? { cases: cases.length, answered: answered.length, within30Min: within30,
          medianMinutesToAnswer: median === null ? null : Math.round(median) }
      : { cases: `<${min}`, answered: null, within30Min: null, medianMinutesToAnswer: null },
  };
}
