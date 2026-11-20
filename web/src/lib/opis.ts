// Opis događaja (`description_hr`) kao Markdown, iscrtan na serveru (odluka 19).
//
// Sanitizacija je po konstrukciji, ne naknadnim filtriranjem HTML-a (odluka 302):
// - `html: false`: sirovi HTML iz opisa se escapea, ne iscrtava;
// - markdown-it-ov validateLink odbija javascript:, vbscript:, file: i data: linkove;
// - slike su isključene (kupčev preglednik ne dohvaća ništa s tuđih poslužitelja,
//   kao kod fonta, odluka 200), pa `![alt](url)` ostaje običan tekst;
// - naslovi se spuštaju na h3+ (h1 je naslov događaja, h2 „O događaju”);
// - svaki link dobiva rel="nofollow noopener".
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });
md.disable("image");
md.linkify.set({ fuzzyLink: true, fuzzyEmail: true });

md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  token.tag = `h${Math.min(6, Math.max(3, Number(token.tag.slice(1))))}`;
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.heading_close = (tokens, idx, options, _env, self) => {
  tokens[idx].tag = tokens[idx - 2]?.tag ?? tokens[idx].tag;
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("rel", "nofollow noopener");
  return self.renderToken(tokens, idx, options);
};

/** Markdown → siguran HTML; prazan opis → "". */
export function opisHtml(markdown: string | null | undefined): string {
  const tekst = markdown?.trim();
  return tekst ? md.render(tekst) : "";
}

/**
 * Opis kao običan tekst za `meta description`, `og:description` i JSON-LD:
 * bez Markdown oznaka, razmaci stisnuti, skraćen na riječ.
 */
export function opisTekst(markdown: string | null | undefined, maks = 200): string {
  const html = opisHtml(markdown);
  const tekst = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (tekst.length <= maks) return tekst;
  const rez = tekst.slice(0, maks - 1);
  const zadnjiRazmak = rez.lastIndexOf(" ");
  return `${(zadnjiRazmak > maks / 2 ? rez.slice(0, zadnjiRazmak) : rez).replace(/[\s.,;:–-]+$/, "")}…`;
}
