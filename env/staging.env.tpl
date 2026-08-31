# Staging environment — credentials for reaching the deployed staging stack.
#
#   pnpm env:pull staging   # writes .env.staging
#
# This is for pointing a tool at staging on purpose, e.g.
#   pnpm exec dotenv -e .env.staging -- sh -c 'psql "$DATABASE_URL"'
# Do not source it into a local dev server: `.env.local` is what the app and
# `services/db` read by default, and pointing those at staging is how staging
# data gets rewritten by a local run.
#
# References are `op://Common/staging/<FIELD>`: vault `Common`, item `staging`,
# one field per variable. Nothing here is literal — the URLs identify the
# staging project, and that lives in 1Password with the passwords.

DATABASE_URL=op://Common/staging/DATABASE_URL

NEXT_PUBLIC_SUPABASE_URL=op://Common/staging/NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=op://Common/staging/NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE=op://Common/staging/SUPABASE_SERVICE_ROLE
S3_ASSET_ROOT=op://Common/staging/S3_ASSET_ROOT
