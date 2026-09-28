#!/usr/bin/env bash
# Lokalni demo stack: kupnja od kraja do kraja bez interneta i bez pravih ključeva.
#
#   :55390  edge funkcije events-* iz ../domovina-api, vožene Denom (fn-shim.ts)
#   :8901   lažni Stripe (checkout stranica + potpisan webhook) i Resend inbox
#   :8788   Worker (--env staging) + SPA iz dist/
#
# Preduvjet: lokalni Supabase u ../domovina-api radi (Kong :55321, DB :55322),
# vidi docs/2026-08-04-lokalna-verifikacija-i-nalazi.md §9.
# Ključevi se čitaju iz `supabase status` pri pokretanju — ništa nije upisano ovdje.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
API="$(cd "$REPO/../domovina-api" && pwd)"

eval "$(cd "$API" && supabase status -o env 2>/dev/null)"
: "${SERVICE_ROLE_KEY:?lokalni Supabase ne radi — u ../domovina-api pokreni supabase start}"
secret() { grep "^$1=" "$REPO/.dev.vars" | cut -d= -f2-; }

cd "$REPO"
npm run build >/dev/null
for f in migrations/*.sql; do
  npx wrangler d1 execute domovina-ulaznice-staging --env staging --local --file="$f" >/dev/null
done

pids=()
trap 'kill "${pids[@]}" 2>/dev/null' EXIT INT TERM

FN_ROOT="$API/supabase/functions" SUPABASE_URL=http://127.0.0.1:55321 \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" SUPABASE_ANON_KEY="$ANON_KEY" \
EVENTS_STRIPE_CONFIRM_SECRET="$(secret EVENTS_STRIPE_CONFIRM_SECRET)" \
  deno run -A --no-lock "$HERE/fn-shim.ts" & pids+=($!)

WHSEC="$(secret STRIPE_WEBHOOK_SECRET)" WORKER=http://127.0.0.1:8788 \
  node "$HERE/fake-stripe.mjs" & pids+=($!)

# :8787 je na ovom stroju često zauzet drugim projektom → 8788.
# --var pobjeđuje .dev.vars; ANON_KEY mora biti lokalni, ne produkcijski iz wrangler.jsonc.
npx wrangler dev --env staging --local --port 8788 --ip 127.0.0.1 \
  --var PUBLIC_BASE_URL:http://127.0.0.1:8788 \
  --var DOMOVINA_API_URL:http://127.0.0.1:55390 \
  --var DOMOVINA_API_ANON_KEY:"$ANON_KEY" & pids+=($!)

echo "▶ aplikacija http://127.0.0.1:8788/  ·  inbox http://127.0.0.1:8901/inbox  (Ctrl+C gasi sve)"
wait
