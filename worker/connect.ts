// Stripe Connect onboarding organizatora (2026-11-27, /organizator/postavke).
//
// Tok: organizator (admin računa u jezgri) klikne „Poveži Stripe” → Worker za
// taj račun stvori connected account (ako ga još nema) i Account Link →
// organizator ispuni Stripeov hostani onboarding → vraća se na
// /organizator/postavke, gdje Worker odmah pročita stanje računa sa Stripea.
// `account.updated` webhook (worker/webhooks.ts) isto stanje osvježava i inače.
//
// Tip računa je `STRIPE_CONNECT_TIP` (zadano `standard`): chargeback i spor nosi
// organizator, nema dodatnog Stripe troška — preporuka iz docs/03 §5 i
// docs/2026-11-23 §3. Odluka za produkciju je još otvorena (plan do produkcije
// §3.1); connected account se ne seli među tipovima bez novog onboardinga.
//
// Granice (docs/03 §2, CLAUDE.md): `acct_…` nikad ne izlazi prema browseru —
// klijent dobiva samo booleane. Pravo na račun provjerava jezgra:
// `organizer_overview` s korisnikovim JWT-om vraća samo račune na kojima je
// korisnik admin; tek onda Worker service ključem piše
// `ulaznice.organizer_payment_rails` (tablicu piše isključivo service_role).
import type Stripe from "stripe";
import type { Env } from "./env";
import { HttpError } from "./env";
import * as api from "./api";
import { stripeClient } from "./stripe";

/** MCC za ulaznice / predstave (docs/03 §2). */
const MCC_ULAZNICE = "7922";

export type TipRacuna = "standard" | "express";

export function tipRacuna(env: Pick<Env, "STRIPE_CONNECT_TIP">): TipRacuna {
  return env.STRIPE_CONNECT_TIP === "express" ? "express" : "standard";
}

/** Stanje Stripea za jedan račun organizatora, bez `acct_…`. */
export interface StripeStanje {
  povezan: boolean;
  /** Smije primati uplate (charges_enabled i details_submitted) — tek tada je događaj kupovan. */
  naplata: boolean;
  isplate: boolean;
}

export interface RacunPostavki {
  id: string;
  name: string;
  is_personal: boolean;
  stripe: StripeStanje;
}

interface Rail {
  account_id: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
}

interface RacunJezgre {
  id: string;
  name: string;
  is_personal?: boolean;
}

/** Računi na kojima je korisnik admin (jezgra odlučuje, ne mi). */
async function adminRacuni(env: Env, jwt: string): Promise<RacunJezgre[]> {
  const p = await api.korisnickiRpc<{ accounts?: RacunJezgre[] }>(env, jwt, "organizer_overview");
  return p.accounts ?? [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function railovi(env: Env, ids: string[]): Promise<Map<string, Rail>> {
  const cisti = ids.filter((id) => UUID_RE.test(id));
  if (cisti.length === 0) return new Map();
  const redci = await api.servisRest<Rail[]>(
    env,
    "organizer_payment_rails?select=account_id,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled" +
      `&account_id=in.(${cisti.join(",")})`,
  );
  return new Map(redci.map((r) => [r.account_id, r]));
}

/** Booleani iz Stripe računa — isto pravilo kao `account.updated` u webhooks.ts. */
export function stanjeIzRacuna(a: Pick<Stripe.Account, "charges_enabled" | "details_submitted" | "payouts_enabled">): {
  charges_enabled: boolean;
  payouts_enabled: boolean;
} {
  return { charges_enabled: !!a.charges_enabled && !!a.details_submitted, payouts_enabled: !!a.payouts_enabled };
}

/**
 * Postavke organizatora: njegovi računi i stanje Stripea. Račun koji je
 * povezan, a još ne prima uplate, osvježi se izravno sa Stripea (povratak s
 * onboardinga stiže prije webhooka; webhook ionako zapisuje isto).
 */
export async function postavke(env: Env, jwt: string): Promise<{ stripe_dostupan: boolean; racuni: RacunPostavki[] }> {
  const racuni = await adminRacuni(env, jwt);
  const rails = await railovi(
    env,
    racuni.map((r) => r.id),
  );
  const stripe = env.STRIPE_SECRET_KEY ? stripeClient(env) : null;

  const out: RacunPostavki[] = [];
  for (const r of racuni) {
    const rail = rails.get(r.id);
    let naplata = !!rail?.stripe_charges_enabled;
    let isplate = !!rail?.stripe_payouts_enabled;
    if (stripe && rail?.stripe_account_id && !naplata) {
      try {
        const s = stanjeIzRacuna(await stripe.accounts.retrieve(rail.stripe_account_id));
        if (s.charges_enabled !== naplata || s.payouts_enabled !== isplate) {
          await api.upsertOrganizerRail(env, { stripe_account_id: rail.stripe_account_id, ...s });
        }
        naplata = s.charges_enabled;
        isplate = s.payouts_enabled;
      } catch (e) {
        // Stripe nedostupan ili ključ bez dozvole: pokaži zapisano stanje.
        console.warn("connect: accounts.retrieve", e instanceof Error ? e.message : e);
      }
    }
    out.push({
      id: r.id,
      name: r.name,
      is_personal: !!r.is_personal,
      stripe: { povezan: !!rail?.stripe_account_id, naplata, isplate },
    });
  }
  return { stripe_dostupan: !!stripe, racuni: out };
}

/**
 * E-mail iz JWT-a, samo kao prijedlog Stripeu za obrazac. Potpis se ovdje ne
 * provjerava: isti token je upravo prošao jezgru (`organizer_overview`).
 */
export function emailIzJwt(jwt: string): string | null {
  try {
    const dio = jwt.split(".")[1] ?? "";
    const json = JSON.parse(atob(dio.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: unknown };
    return typeof json.email === "string" && json.email.includes("@") ? json.email : null;
  } catch {
    return null;
  }
}

/** Kamo Stripe vraća organizatora (povratak i istekli link). */
export function adreseOnboardinga(base: string, accountId: string): { return_url: string; refresh_url: string } {
  const racun = encodeURIComponent(accountId);
  return {
    return_url: `${base}/organizator/postavke?stripe=povratak&racun=${racun}`,
    refresh_url: `${base}/organizator/postavke?stripe=obnovi&racun=${racun}`,
  };
}

/**
 * „Poveži Stripe”: connected account za račun organizatora (jednom; idempotency
 * key po računu štiti od dvostrukog klika) i svjež Account Link.
 */
export async function poveziStripe(
  env: Env,
  jwt: string,
  accountId: string,
  email: string | null,
): Promise<{ url: string }> {
  if (!UUID_RE.test(accountId)) throw new HttpError(400, "invalid_account_id");
  const racun = (await adminRacuni(env, jwt)).find((r) => r.id === accountId);
  if (!racun) throw new HttpError(403, "not_authorized");

  const stripe = stripeClient(env);
  const rail = (await railovi(env, [accountId])).get(accountId);
  try {
    return await onboarding(env, stripe, accountId, racun.name, rail?.stripe_account_id ?? null, email);
  } catch (e) {
    throw stripeGreska(e);
  }
}

/**
 * Greška Stripea → strojni kod za browser. Restricted key bez dozvola
 * Accounts / Account Links (docs/2026-11-23 §3.4) daje `stripe_bez_dozvole`.
 */
export function stripeGreska(e: unknown): unknown {
  if (e instanceof HttpError) return e;
  const err = e as { type?: string; message?: string; statusCode?: number };
  if (err?.type === "StripePermissionError" || err?.statusCode === 403) {
    return new HttpError(502, "stripe_bez_dozvole", `connect: ${err.message ?? ""}`);
  }
  if (typeof err?.type === "string" && err.type.startsWith("Stripe")) {
    return new HttpError(502, "stripe_onboarding_neuspio", `connect: ${err.type} ${err.message ?? ""}`);
  }
  return e;
}

async function onboarding(
  env: Env,
  stripe: Stripe,
  accountId: string,
  ime: string,
  postojeci: string | null,
  email: string | null,
): Promise<{ url: string }> {
  let acct = postojeci;

  if (!acct) {
    const tip = tipRacuna(env);
    const novi = await stripe.accounts.create(
      {
        type: tip,
        country: "HR",
        ...(email ? { email } : {}),
        business_profile: { name: ime, mcc: MCC_ULAZNICE },
        metadata: { domovina_account_id: accountId },
        ...(tip === "express"
          ? { capabilities: { card_payments: { requested: true }, transfers: { requested: true } } }
          : {}),
      },
      { idempotencyKey: `ulaznice-connect-${accountId}` },
    );
    acct = novi.id;
    await api.spremiStripeRacun(env, accountId, acct, stanjeIzRacuna(novi));
  }

  const link = await stripe.accountLinks.create({
    account: acct,
    type: "account_onboarding",
    ...adreseOnboardinga(env.PUBLIC_BASE_URL, accountId),
  });
  return { url: link.url };
}
