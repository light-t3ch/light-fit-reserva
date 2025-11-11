export const LOCATION_SEEDS = [
  { slug: "noda-hanshin", name: "野田阪神店", timezone: "Asia/Tokyo", address: "大阪市福島区海老江" },
  { slug: "fukushima", name: "福島店", timezone: "Asia/Tokyo", address: "大阪市福島区福島" },
  { slug: "awaza", name: "阿波座店", timezone: "Asia/Tokyo", address: "大阪市西区阿波座" },
  { slug: "ebie", name: "海老江店", timezone: "Asia/Tokyo", address: "大阪市福島区海老江" },
  { slug: "kujo", name: "九条店", timezone: "Asia/Tokyo", address: "大阪市西区九条" },
  { slug: "higobashi", name: "肥後橋店", timezone: "Asia/Tokyo", address: "大阪市西区江戸堀" },
  { slug: "tsukamoto", name: "塚本店", timezone: "Asia/Tokyo", address: "大阪市淀川区塚本" },
  { slug: "temma", name: "天満店", timezone: "Asia/Tokyo", address: "大阪市北区天神橋" },
  { slug: "tamatsukuri", name: "玉造店", timezone: "Asia/Tokyo", address: "大阪市中央区玉造" },
] as const;

export type LocationSeed = (typeof LOCATION_SEEDS)[number];
