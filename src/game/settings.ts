export const LANGS = ["en", "es", "de", "hi", "ja", "zh"] as const;
export type Lang = (typeof LANGS)[number];

export type Settings = {
  volume: number;
  lang: Lang;
};

const KEY = "freedom-settings-v1";
const DEFAULTS: Settings = { volume: 80, lang: "en" };

let current: Settings = DEFAULTS;

function clampVolume(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULTS.volume;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parse(raw: string | null): Settings {
  if (!raw) return DEFAULTS;
  try {
    const d = JSON.parse(raw) as { volume?: unknown; lang?: unknown };
    const lang = LANGS.includes(d.lang as Lang) ? (d.lang as Lang) : "en";
    return { volume: clampVolume(d.volume), lang };
  } catch {
    return DEFAULTS;
  }
}

export function bootSettings(): Settings {
  if (typeof localStorage === "undefined") return current;
  current = parse(localStorage.getItem(KEY));
  return current;
}

export function getSettings(): Settings {
  return current;
}

export function saveSettings(next: Settings) {
  current = {
    volume: clampVolume(next.volume),
    lang: LANGS.includes(next.lang) ? next.lang : "en",
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* the phone refused the write; keep the in-memory choice */
  }
}
