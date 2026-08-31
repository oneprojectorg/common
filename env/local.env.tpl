# Local development environment.
#
# Materialise it with `pnpm env:pull`, which resolves the `op://` references
# below against 1Password and writes `.env.local`. Never put a real credential
# in this file — it is committed. Values that are safe to commit (localhost
# URLs, the well-known Supabase local dev keys) stay literal, so a new machine
# needs 1Password only for the handful of real secrets.
#
# References are `op://Common/local/<FIELD>`: vault `Common`, item `local`, one
# field per variable.

EMAIL_SMTP_URL=smtp://127.0.0.1:54325
# Local mail is captured by Mailpit, so Resend is never called — this is a
# well-formed placeholder, not a key.
RESEND_PASSWORD=re_12345678_abcdefghijklmnopqrstuvwx

## Supabase Local (all are local testing keys rather than actual secrets here)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
DATABASE_URL=postgresql://postgres.pooler-dev:postgres@127.0.0.1:6543/postgres
## Postgres pool tuning (all optional; defaults shown).
## DB_POOL_MAX is the per-process connection pool size — tune to fit the
## Supavisor/Postgres connection budget divided by the number of API instances.
## The statement and in-transaction timeouts cap blast radius from a stuck query
## or a transaction holding a socket past the HTTP timeout.
# DB_POOL_MAX=10
# DB_STATEMENT_TIMEOUT_MS=30000
# DB_IDLE_IN_TXN_TIMEOUT_MS=60000
# DB_CONNECT_TIMEOUT_S=30
S3_ASSET_ROOT="http://127.0.0.1:54321/storage/v1/object/public/assets"

# Shared local-dev cookie encryption key. Generate your own with:
# crypto.subtle.generateKey({name: "AES-CBC", length: 256,},true,["encrypt", "decrypt"]).then((key) => crypto.subtle.exportKey("jwk", key)).then(JSON.stringify).then(console.log)
SSR_SECRETS_KEY={"alg":"A256CBC","ext":true,"k":"xUWFSEEnQPIlAkPqTxnIsZz5VRacNPEOzvG5ZBSJYN4","key_ops":["encrypt","decrypt"],"kty":"oct"}

## Redis (optional - falls back to in-memory cache if not set)
REDIS_URL=redis://localhost:6379

## TipTap Cloud (Real-time collaborative editing)
# TIPTAP_PRO_TOKEN also authenticates pnpm against the @tiptap-pro registry, so
# it has to be in your shell before `pnpm install`:
#   set -a; source .env.local; set +a
NEXT_PUBLIC_TIPTAP_APP_ID=op://Common/local/NEXT_PUBLIC_TIPTAP_APP_ID
TIPTAP_SECRET=op://Common/local/TIPTAP_SECRET
TIPTAP_PRO_TOKEN=op://Common/local/TIPTAP_PRO_TOKEN

## Optional integrations. Each is off until you set it, and each is a real
## credential, so none of them are listed as references above: `op inject`
## resolves every reference in this file including ones inside comments, and a
## reference to a field that does not exist fails the whole pull. To turn one
## on, add the field to the `local` item in 1Password, then add a live line
## here in the same shape as the TipTap ones — VAR=op://Common/local/VAR.
##
## OTEL_EXPORTER_OTLP_HEADERS  OpenTelemetry export, as
##                             `Authorization=Bearer <posthog project api key>`.
##                             Needs OTEL_EXPORTER_OTLP_ENDPOINT set too — for
##                             PostHog EU that is https://eu.i.posthog.com/i
##                             (the exporters append /v1/logs, /v1/traces,
##                             /v1/metrics). Unset = export disabled.
## POSTHOG_API_KEY             PostHog source map upload, build-time only (see
## POSTHOG_ENV_ID              withPostHogConfig in apps/app/next.config.mjs).
##                             Uploads run only on the `dev` and `main` deploy
##                             builds, so these live in the Vercel project env
##                             and are not needed locally.
## IFRAMELY_KEY                Link preview embeds.
## DEEPL_API_KEY               Machine translation.
## OPENL_RAPIDAPI_KEY          Machine translation via OpenL on RapidAPI, for
##                             the languages DeepL lacks (e.g. Somali).
## AI_API_KEY                  Model inference via @op/ai, any OpenAI-compatible
## AI_BASE_URL                 provider. Deploy-level fallbacks only — endpoint
##                             and key are normally configured at runtime and
##                             passed to @op/ai per agent.
## NEXT_PUBLIC_MAPTILER_API_KEY  Publishable client key for the location
##                             picker's basemap. Unset, the picker falls back to
##                             OpenFreeMap's public `liberty` style at
##                             https://tiles.openfreemap.org, so the map still
##                             renders.
## MODERATION_API_KEY          Content moderation. Checkstep serves both the
##                             sync gate and async review; setting the key turns
##                             moderation on. The three settings below are plain
##                             config rather than credentials — uncomment them
##                             as-is if the deployment needs them.
##
## `MODERATION_PROVIDER` is optional and may only be `checkstep`. Checkstep
## policies are configured per-account (docs.checkstep.com/glossary), so the
## deployment's own codes trump ours: `MODERATION_POLICY_MAP` is a JSON object
## mapping Checkstep policy codes to our categories (`hate`/`violence`/`sexual`/
## `harassment`/`profanity`/`csam`/`other`), and `MODERATION_DETACH_POLICIES` is
## a comma list of policy codes that trigger the mandatory-detach path (removal
## even from admin views). Both fall back to the adapter defaults. NOTE: each
## override REPLACES its default entirely — setting MODERATION_DETACH_POLICIES=CEX
## disables the TER detach; list every code the deployment wants detached.
# MODERATION_PROVIDER=checkstep
# MODERATION_POLICY_MAP={"HTE":"hate","VLC":"violence","CEX":"csam"}
# MODERATION_DETACH_POLICIES=CEX,TER
