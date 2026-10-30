import type { ServiceEntry } from "../types.ts";

/**
 * SERVICE DIRECTORY. Entries below are SAMPLES so the demo has something to
 * show. They are NOT real organisations. In live mode only entries with a
 * named verifiedBy + verifiedAt are ever shown. Replace this list with the
 * directory your partners have verified in writing.
 */
const sample = (district: string, kind: ServiceEntry["kind"], name: string): ServiceEntry => ({
  id: `${district}-${kind}`,
  kind,
  name: `[SAMPLE] ${name}`,
  district,
  phone: "0700 000 000",
  hours: "Mon-Fri 8-16",
  verifiedBy: null,
  verifiedAt: null,
});

const IDS = ["mbeya-city", "mbeya-rural", "chunya", "kyela", "rungwe", "busokelo", "mbarali"];

export const SERVICES: ServiceEntry[] = IDS.flatMap((d) => [
  sample(d, "clinic", "Youth clinic"),
  sample(d, "legal", "Legal aid desk"),
  sample(d, "welfare", "Social welfare office"),
  sample(d, "counselling", "Counselling service"),
]);
