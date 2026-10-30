import type { District } from "../types.ts";

// Mbeya Region districts. A new region = a new list here, no engine changes.
export const DISTRICTS: District[] = [
  { id: "mbeya-city", name: "Mbeya Jiji", aliases: ["mbeya", "mbeya jiji", "mbeya city", "mbeyacity"] },
  { id: "mbeya-rural", name: "Mbeya Vijijini", aliases: ["mbeya vijijini", "mbeya rural", "mbeyarural"] },
  { id: "chunya", name: "Chunya", aliases: ["chunya"] },
  { id: "kyela", name: "Kyela", aliases: ["kyela"] },
  { id: "rungwe", name: "Rungwe", aliases: ["rungwe", "tukuyu"] },
  { id: "busokelo", name: "Busokelo", aliases: ["busokelo"] },
  { id: "mbarali", name: "Mbarali", aliases: ["mbarali", "rujewa"] },
];
