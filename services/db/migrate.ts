/* eslint-disable antfu/no-top-level-await */

import fs from 'fs';
import path from 'path';

import { createServerClient } from '@supabase/ssr';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import config from './drizzle.config';

import { db } from '.';

if (!process.env.DB_MIGRATING) {
  throw new Error(
    'You must set DB_MIGRATING to "true" when running migrations',
  );
}

if (
  process.env.DATABASE_URL
  !== 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
) {
  throw new Error('You are running migrations in production');
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

// First run regular drizzle migrations
await migrate(db, {
  migrationsFolder: './migrations',
  migrationsSchema: config.migrations?.schema,
  migrationsTable: config.migrations?.table,
});

// Then handle custom migrations that need to run outside transactions
const customMigrationsPath = path.join(process.cwd(), 'customMigrations');
const sqlFiles = fs
  .readdirSync(customMigrationsPath)
  .filter((file: string) => file.endsWith('.sql'))
  .map((file: string) => path.join(customMigrationsPath, file));

// Use the raw connection for executing CONCURRENT index creation
for (const sqlFile of sqlFiles) {
  const sqlData = fs.readFileSync(sqlFile, 'utf8');
  const statements = sqlData.split('--> statement-breakpoint');

  // Execute each statement separately without transaction
  for (const statement of statements) {
    const trimmedStatement = statement.trim();

    if (trimmedStatement) {
      await db.execute(sql.raw(trimmedStatement));
    }
  }
}

await db.$client.end();
