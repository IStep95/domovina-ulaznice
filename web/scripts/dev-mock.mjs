#!/usr/bin/env node
// `npm run dev:mock`: lokalni mock API (mobile/mock-api.mjs, :8797) + `astro dev` (:4321).
// Mock dobiva PUBLIC_BASE_URL=http://localhost:4321, pa njegov lažni Checkout
// („Plati”) vraća na Astro: http://localhost:4321/ulaznice/<id>?placeno=1 (odluka 7).
// Preglednik do mocka ide kroz Vite proxy (/api, /mock-checkout u astro.config.mjs),
// SSR izravno na http://localhost:8797 (src/lib/api-ssr.ts).
// Ctrl+C (ili pad jednog procesa) gasi oba.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const mockApi = fileURLToPath(new URL("../../mobile/mock-api.mjs", import.meta.url));
const astroBin = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));

const children = [
  spawn(process.execPath, [mockApi], {
    cwd: webDir,
    stdio: "inherit",
    env: { ...process.env, PORT: "8797", PUBLIC_BASE_URL: "http://localhost:4321" },
  }),
  // --ignore-lock: Astro 7 u agentskom okruženju (Claude Code, Cursor…) sam prebaci
  // `astro dev` u pozadinu i odmah izađe; ovdje ga držimo u prvom planu da ga
  // ova skripta gasi zajedno s mockom.
  spawn(process.execPath, [astroBin, "dev", "--port", "4321", "--ignore-lock", ...process.argv.slice(2)], {
    cwd: webDir,
    stdio: "inherit",
    env: process.env,
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
