// Ikone iz izvoza dizajna (web/design/canvas/*.dc.html): obrisi 24×24, stroke
// currentColor. Samo podaci, da ih crtaju i Ikona.astro i React otoci.

export interface IkonaOblik {
  /** Unutrašnjost <svg>: path/circle/rect s atributima. */
  sadrzaj: string;
  /** Debljina crte; zadano 2. */
  crta?: number;
}

export const IKONE = {
  /** logo i „Bez provizije” */
  ulaznica: { sadrzaj: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8z"/>' },
  /** logo u zaglavlju: ulaznica s perforacijom */
  logo: {
    sadrzaj:
      '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  },
  /** 404 događaja */
  "ulaznica-x": {
    sadrzaj:
      '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="m10 10 4 4M14 10l-4 4"/>',
  },
  mjesto: { sadrzaj: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>' },
  /** banner neutral */
  info: { sadrzaj: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>' },
  /** banner ok */
  "ok-krug": { sadrzaj: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>' },
  /** banner error */
  upozorenje: { sadrzaj: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>' },
  /** banner wait, pending */
  sat: { sadrzaj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  /** paid */
  kvacica: { sadrzaj: '<path d="m5 12 5 5 9-10"/>', crta: 2.5 },
  /** expired */
  "usklik-krug": { sadrzaj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16h.01"/>' },
  /** failed */
  "x-krug": { sadrzaj: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>' },
  /** refunded */
  povrat: { sadrzaj: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>' },
  /** slanje u tijeku; vrti se (klasa u komponenti) */
  vrtnja: { sadrzaj: '<path d="M21 12a9 9 0 1 1-6.2-8.56"/>', crta: 2.5 },
  natrag: { sadrzaj: '<path d="m15 18-6-6 6-6"/>' },
  /** „Kupujete izravno od organizatora” */
  lokot: { sadrzaj: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>' },
  email: { sadrzaj: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>' },
  vanjski: { sadrzaj: '<path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>' },
} satisfies Record<string, IkonaOblik>;

export type IkonaIme = keyof typeof IKONE;

/** Ikona banera po tonu (pravilo 3: banner uvijek ima ikonu i tekst). */
export const IKONA_TONA = {
  ok: "ok-krug",
  wait: "sat",
  error: "upozorenje",
  neutral: "info",
} as const satisfies Record<string, IkonaIme>;

export type Ton = keyof typeof IKONA_TONA;
