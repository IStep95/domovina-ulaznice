#!/usr/bin/env node
// `npm run dev:mock`: lokalni mock API (mobile/mock-api.mjs) + `astro dev`.
//
//   WEB_PORT   port Astra (zadano 4321); mock dobiva PUBLIC_BASE_URL=http://localhost:<WEB_PORT>,
//              pa njegov lažni Checkout („Plati”) vraća na Astro: /ulaznice/<id>?placeno=1 (odluka 7)
//   MOCK_PORT  port mocka (zadano 8797)
//
//   WEB_PORT=4331 MOCK_PORT=8798 npm run dev:mock   # uz Ivanov `astro dev` na :4321 (odluka 412)
//
// Adresa mocka mora nadjačati web/.dev.vars (API_BASE_URL_DEV za lokalni stack), a tu
// datoteku se ne dira. Wrangler (pa i @cloudflare/vite-plugin) čita `.dev.vars` iz
// direktorija Wrangler configa i njime UVIJEK pregazi `vars` iz configa; process.env se uz
// postojeći `.dev.vars` ne čita uopće. Zato ova skripta u node_modules/.dev-mock-<WEB_PORT>/
// složi kopiju wrangler.jsonc i uz nju vlastiti `.dev.vars` s adresom mocka, a astro.config.mjs
// kroz WEB_WRANGLER_CONFIG uzme taj config. Isti `.dev.vars` čita i Vite proxy u
// astro.config.mjs, pa preglednik (/api, /mock-checkout) i SSR (src/lib/api-ssr.ts) idu na
// isti mock.
//
// Vite cache je zaseban (WEB_VITE_CACHE, zadano node_modules/.dev-mock-<WEB_PORT>/vite):
// drugi `astro dev` sa zajedničkim node_modules/.vite/deps ruši onaj koji već radi
// (`_jsxDEV is not a function`, web/docs/handoffs/S5.md).
//
// Ctrl+C (ili pad jednog procesa) gasi oba.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { experimental_readRawConfig } from "wrangler";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const mockApi = fileURLToPath(new URL("../../mobile/mock-api.mjs", import.meta.url));
const astroBin = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));

const webPort = port("WEB_PORT", 4321);
const mockPort = port("MOCK_PORT", 8797);
const radni = fileURLToPath(new URL(`../node_modules/.dev-mock-${webPort}/`, import.meta.url));

function port(ime, zadano) {
  const v = process.env[ime] ?? String(zadano);
  if (!/^\d{1,5}$/.test(v) || Number(v) < 1 || Number(v) > 65535) {
    console.error(`${ime}=${v} nije port`);
    process.exit(2);
  }
  return Number(v);
}

// Kopija wrangler.jsonc u drugom direktoriju (JSON bez komentara). `main` je ime paketa pa
// ga razrješava Vite, neovisno o direktoriju; `assets.directory` mora biti apsolutan.
function wranglerConfigZaMock() {
  const { rawConfig } = experimental_readRawConfig({ config: fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)) });
  const config = structuredClone(rawConfig);
  for (const c of [config, ...Object.values(config.env ?? {})]) {
    if (c.assets?.directory) c.assets.directory = fileURLToPath(new URL(c.assets.directory, new URL("..", import.meta.url)));
  }
  mkdirSync(radni, { recursive: true });
  const put = `${radni}wrangler.json`;
  writeFileSync(put, JSON.stringify(config, null, 2) + "\n");
  // Pod CLOUDFLARE_ENV Wrangler prvo traži `.dev.vars.<env>`; ovdje ga nema, pa vrijedi ovaj.
  writeFileSync(`${radni}.dev.vars`, `# Generira scripts/dev-mock.mjs, ne uređivati.\nAPI_BASE_URL_DEV=http://localhost:${mockPort}\n`);
  return put;
}

const env = {
  ...process.env,
  WEB_WRANGLER_CONFIG: wranglerConfigZaMock(),
  WEB_VITE_CACHE: process.env.WEB_VITE_CACHE ?? `${radni}vite`,
};

const children = [
  spawn(process.execPath, [mockApi], {
    cwd: webDir,
    stdio: "inherit",
    env: { ...process.env, PORT: String(mockPort), PUBLIC_BASE_URL: `http://localhost:${webPort}` },
  }),
  // --ignore-lock: Astro 7 u agentskom okruženju (Claude Code, Cursor…) sam prebaci
  // `astro dev` u pozadinu i odmah izađe; ovdje ga držimo u prvom planu da ga
  // ova skripta gasi zajedno s mockom.
  spawn(process.execPath, [astroBin, "dev", "--port", String(webPort), "--ignore-lock", ...process.argv.slice(2)], {
    cwd: webDir,
    stdio: "inherit",
    env,
  }),
];

let stopping = false;
function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGTERM");
  process.exitCode = code;
}
for (const c of children) c.on("exit", (code) => stopAll(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stopAll(0));
