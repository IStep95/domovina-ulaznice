#!/usr/bin/env bash
# Astro frontend (web/) za lokalni stack: build za staging i `wrangler dev` na :8792.
#
# Glavni Worker iz pokreni.sh (:8788) šalje kupačke putanje (/, /dogadjaj/*, /ulaznice/*,
# /uvjeti…) kroz service binding WEB na servis `domovina-ulaznice-web-staging`; `wrangler dev`
# ga nalazi u dev registryju po imenu. Bez ovog procesa te putanje na :8788 daju 503
# („Couldn't find `wrangler dev` session”), a /api i dalje radi.
#
# Diže ga pokreni.sh. Sam, uz stack koji već radi (npr. nakon izmjene u web/):
#   scripts/lokalno/pokreni-web.sh          # Ctrl+C gasi samo Astro
#   SKIP_BUILD=1 scripts/lokalno/pokreni-web.sh   # bez astro build, zadnji build
# Varijable: WEB_PORT (8792), API_URL (http://127.0.0.1:8788, SSR → /api glavnog Workera).
#
# Zamke (web/docs/research/2026-11-20-lokalna-e2e-kroz-astro.md):
# - Korijenski wrangler (3.114), ne onaj iz web/ (4.165): registry wranglera 3 i 4 ima drugi
#   oblik i ne vide se. Workerd iz 3.114 zna compatibility_date najviše 2025-07-18 i na to
#   spusti Astrov 2025-11-01 (samo upozorenje).
# - Vrti se kopija builda (.wrangler/web-build): novi `astro build` (npm run check) briše
#   web/dist i `wrangler dev` nad njim padne (ENOENT dist/client).
# - Build ima zaseban Vite cache, da ne dira node_modules/.vite Ivanovog `astro dev`.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WEB_PORT="${WEB_PORT:-8792}"
API_URL="${API_URL:-http://127.0.0.1:8788}"
KOPIJA="$REPO/.wrangler/web-build"

if lsof -nP -iTCP:"$WEB_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port $WEB_PORT je zauzet (Astro već radi?)" >&2; exit 1
fi

# CLOUDFLARE_ENV=staging: Worker se zove domovina-ulaznice-web-staging, kao servis u bindingu.
if [ "${SKIP_BUILD:-}" != 1 ]; then
  (cd "$REPO/web" && CLOUDFLARE_ENV=staging WEB_VITE_CACHE="$REPO/web/node_modules/.web-stack/vite" \
    ASTRO_TELEMETRY_DISABLED=1 node_modules/.bin/astro build >/dev/null)
  mkdir -p "$KOPIJA"
  rsync -a --delete "$REPO/web/dist/" "$KOPIJA/"
  # Build kopira web/.dev.vars (Ivanov API_BASE_URL_DEV); build ga ne čita, a ovdje ne treba.
  rm -f "$KOPIJA/server/.dev.vars"
fi
[ -f "$KOPIJA/server/wrangler.json" ] || { echo "nema builda u $KOPIJA — pokreni bez SKIP_BUILD" >&2; exit 1; }

cd "$REPO"
echo "▶ Astro (web/) http://127.0.0.1:$WEB_PORT/  ·  API $API_URL"
exec "$REPO/node_modules/.bin/wrangler" dev -c "$KOPIJA/server/wrangler.json" \
  --port "$WEB_PORT" --ip 127.0.0.1 --var API_BASE_URL:"$API_URL"
