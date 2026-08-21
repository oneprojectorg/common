import { createServerClient } from '@supabase/ssr';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { db } from '.';
import config from './drizzle.config';

if (
  process.env.VERCEL_ENV === 'preview' &&
  process.env.VERCEL_GIT_COMMIT_REF !== 'dev'
) {
  console.log('Skipping migrations on Vercel preview branch');
  process.exit(0);
}

if (!process.env.DB_MIGRATING) {
  throw new Error(
    'You must set DB_MIGRATING to "true" when running migrations',
  );
}

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  {
    cookieOptions: {},
    cookies: {
      getAll: async () => [],
      setAll: async () => {},
    },
  },
);

await supabase.storage.createBucket('assets', {
  public: true,
  fileSizeLimit: 50 * 1024 * 1024,
});

await supabase.storage.createBucket('avatars', {
  public: true,
  fileSizeLimit: 50 * 1024 * 1024,
});

// Proposal exports, kept out of the public buckets above because an export CSV
// carries proposal submitter names: reading one requires a signed URL. Nothing
// writes here yet — the export pipeline still targets `assets` and is repointed
// at this bucket in a follow-up. Provisioning lands first so the bucket already
// exists in every environment by the time that code ships. The name must match
// the `EXPORTS_BUCKET` constant that follow-up sets, spelled out here the same
// way `assets` and `avatars` are — `services/db` does not depend on
// `@op/common`.
const EXPORTS_BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: 50 * 1024 * 1024,
};

// Create-if-absent, then re-assert the visibility. `createBucket` only decides
// what a *new* bucket looks like — every later run fails with "already exists" —
// so without the update a bucket flipped public by hand (dashboard, a restored
// project) would stay public through every subsequent deploy.
//
// Both errors are discarded, the way the two calls above discard theirs. The
// verification below is what reports a problem, because it reads the end state
// instead of trying to sort benign failures from real ones (the duplicate-bucket
// error carries no distinguishing code — `statusCode` is undefined and `status`
// is 400, not 409).
await supabase.storage.createBucket('exports', EXPORTS_BUCKET_CONFIG);
await supabase.storage.updateBucket('exports', EXPORTS_BUCKET_CONFIG);

// First run regular drizzle migrations
await migrate(db, {
  migrationsFolder: './migrations',
  migrationsSchema: config.migrations?.schema,
  migrationsTable: config.migrations?.table,
});

// Checked after the migrations, and only a confirmed leak fails the run.
//
// The two placements each cost something and only one cost is acceptable.
// Failing *before* `migrate()` means a storage hiccup — a 5xx, a container still
// starting — holds back every pending schema migration, which has nothing to do
// with the bucket. Failing after means the schema is applied and the deploy
// stops, which is what a failed deploy looks like anyway.
//
// So: a bucket this can see and that is public is a real leak and stops the
// deploy. Everything else warns. A missing bucket does not leak — the export
// workflow fails loudly at upload — and cannot be told apart from a transient
// error here, since every bucket and signing error from this Supabase build
// carries `status` 400.
const { data: exportsBucket, error: exportsBucketError } =
  await supabase.storage.getBucket('exports');

if (exportsBucket?.public) {
  console.error(
    'The exports bucket is PUBLIC. Proposal exports carry submitter names and must only be readable through a signed URL.',
  );
  process.exitCode = 1;
} else if (exportsBucketError) {
  console.warn(
    `Could not verify the exports bucket is private: ${exportsBucketError.message}. Proposal exports may fail at upload.`,
  );
}

// Then handle custom migrations that need to run outside transactions
// const customMigrationsPath = path.join(process.cwd(), 'customMigrations');
// const sqlFiles = fs
// .readdirSync(customMigrationsPath)
// .filter((file: string) => file.endsWith('.sql'))
// .map((file: string) => path.join(customMigrationsPath, file));

// // Use the raw connection for executing CONCURRENT index creation
// for (const sqlFile of sqlFiles) {
// const sqlData = fs.readFileSync(sqlFile, 'utf8');
// const statements = sqlData.split('--> statement-breakpoint');

// // Execute each statement separately without transaction
// for (const statement of statements) {
// const trimmedStatement = statement.trim();

// if (trimmedStatement) {
// await db.execute(sql.raw(trimmedStatement));
// }
// }
// }

await db.$client.end();
