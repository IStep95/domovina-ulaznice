// Upload slike u editoru (/organizator/novi, korak 3): naslovna ili galerija.
// Prije slanja preglednik sliku smanji na najviše NAJVECA_STRANICA px po duljoj
// stranici i pretvori u WebP (ili JPEG gdje canvas ne zna WebP, npr. stariji
// Safari), pa fotografija s mobitela od 8 MB postane ~300 kB. Worker je šalje u
// Supabase Storage (`POST /api/organizator/slika`, bucket `pinka-covers`).
// Čiste funkcije su testirane u web/test/slika.test.ts; `pripremiSliku` treba
// DOM (canvas) i provjerava se ručno u pregledniku.

/** Dulja stranica nakon smanjivanja; kartica i galerija ne trebaju više. */
export const NAJVECA_STRANICA = 1600;

/** Vrste koje bucket prima (Worker `VRSTE_SLIKA`). */
export const VRSTE_ZA_SLANJE = ["image/webp", "image/jpeg", "image/png", "image/avif"] as const;

/** Ulaz koji preglednik zna dekodirati; HEIC s iPhonea Safari pretvori sam pri odabiru. */
export const PRIHVACA = "image/jpeg,image/png,image/webp,image/avif,image/gif";

/** Limit bucketa; nakon smanjivanja se realno ne dosegne. */
export const NAJVECA_DATOTEKA = 5 * 1024 * 1024;

/** Dimenzije nakon smanjivanja, s očuvanim omjerom; manje slike se ne povećavaju. */
export function smanjeneDimenzije(
  sirina: number,
  visina: number,
  najvise = NAJVECA_STRANICA,
): { sirina: number; visina: number } {
  if (!(sirina > 0 && visina > 0)) return { sirina: 0, visina: 0 };
  const omjer = Math.min(1, najvise / Math.max(sirina, visina));
  return { sirina: Math.max(1, Math.round(sirina * omjer)), visina: Math.max(1, Math.round(visina * omjer)) };
}

/**
 * Treba li sliku uopće crtati ispočetka: mala slika u vrsti koju bucket prima
 * ide kakva jest (i GIF bi izgubio animaciju, ali GIF bucket ionako ne prima).
 */
export function saljeSeKakvaJest(vrsta: string, velicina: number, sirina: number, visina: number): boolean {
  return (
    (VRSTE_ZA_SLANJE as readonly string[]).includes(vrsta) &&
    velicina <= 1024 * 1024 &&
    Math.max(sirina, visina) <= NAJVECA_STRANICA
  );
}

/** Greška pripreme; `kod` ima poruku u PORUKE_ORGANIZATORA. */
export class GreskaSlike extends Error {
  readonly kod: "slika_vrsta" | "slika_prevelika";
  constructor(kod: "slika_vrsta" | "slika_prevelika") {
    super(kod);
    this.kod = kod;
  }
}

/** Datoteka iz `<input type=file>` → Blob spreman za slanje (smanjen, WebP ili JPEG). */
export async function pripremiSliku(datoteka: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(datoteka);
  } catch {
    throw new GreskaSlike("slika_vrsta");
  }
  try {
    if (saljeSeKakvaJest(datoteka.type, datoteka.size, bitmap.width, bitmap.height)) return datoteka;
    const { sirina, visina } = smanjeneDimenzije(bitmap.width, bitmap.height);
    const platno = document.createElement("canvas");
    platno.width = sirina;
    platno.height = visina;
    const ctx = platno.getContext("2d");
    if (!ctx) throw new GreskaSlike("slika_vrsta");
    ctx.drawImage(bitmap, 0, 0, sirina, visina);
    const kao = (vrsta: string, kvaliteta: number) =>
      new Promise<Blob | null>((ok) => platno.toBlob(ok, vrsta, kvaliteta));
    // canvas bez WebP enkodera vrati PNG; tada JPEG, koji je manji za fotografije
    let blob = await kao("image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") blob = await kao("image/jpeg", 0.85);
    if (!blob) throw new GreskaSlike("slika_vrsta");
    if (blob.size > NAJVECA_DATOTEKA) throw new GreskaSlike("slika_prevelika");
    return blob;
  } finally {
    bitmap.close();
  }
}
