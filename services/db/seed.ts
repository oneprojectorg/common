/* eslint-disable antfu/no-top-level-await */
import { createServerClient } from '@supabase/ssr';
import dotenv from 'dotenv';
import { getTableName, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { OrgType } from 'schema/tables/organizations.sql';

import { adminEmails } from '@op/core';

import * as schema from './schema/publicTables';

import { db } from '.';

import type { Table } from 'drizzle-orm';

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  override: true,
});

if (!process.env.DB_SEEDING) {
  throw new Error('You must set DB_SEEDING to "true" when truncating');
}

if (
  process.env.DATABASE_URL
  !== 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
) {
  throw new Error('You are truncating in production');
}

async function resetTable(
  database: typeof db,
  table: Table,
  schemaName?: string,
) {
  const tableName = getTableName(table);
  const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;

  await database.execute(
    sql.raw(`TRUNCATE TABLE ${fullTableName} RESTART IDENTITY CASCADE`),
  );
}

// Reset public schema tables
for (const table of Object.values(schema).filter(
  value => value instanceof PgTable,
)) {
  await resetTable(db, table);
}

// Reset auth schema table
await resetTable(db, authUsers, 'auth');

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

await supabase.storage.emptyBucket('assets');
await supabase.storage.emptyBucket('avatars');

for (const email of adminEmails) {
  // Create dev user in auth table
  const { error } = await supabase.auth.admin.createUser({
    email,
  });

  if (error) {
    throw new Error('Failed to create dev user');
  }
}

// setup a mock organization
await db.insert(schema.organizations).values({
  name: 'One Testing',
  slug: 'one-testing',
  description: 'A test organization with a some data',
  mission:
    'Our mission is to do lots of things for people and for other things and so forth and sometimes others perhaps there is a way in which we will offer others in a way of things (as such). Maybe in that scenario there is a basis for better understanding and supporting items in a way that makes the most sense potentially. ',
  city: 'San Francisco',
  state: 'CA',
  isOfferingFunds: true,
  email: 'info@oneproject.org',
  website: 'https://oneproject.org',
  type: OrgType.COMMONS,
});

await db.$client.end();
