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

const seedOrgs = [
  {
    name: 'One Project',
    slug: 'one-project',
    description:
      'One Project collaborates with people to build tools, systems and support for the futures ahead. We build deep relationships with communities who share a vision for a new economy.We work alongside them to co- create social and digital infrastructure, and also offer material support to nurture a growing ecosystem of collective action.',
    mission:
      'To nurture a just transition to a regenerative democratic economy.',
    city: 'San Francisco',
    state: 'CA',
    isOfferingFunds: true,
    email: 'info@oneproject.org',
    website: 'https://oneproject.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'New Economy Coalition',
    slug: 'new-economy-coalition',
    description: 'A test organization for New Economy Coalition',
    mission: 'Supporting sustainable economic reforms.',
    city: 'New York',
    state: 'NY',
    isOfferingFunds: false,
    email: 'contact@necoalition.org',
    website: 'https://necoalition.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'People Powered',
    slug: 'people-powered',
    description: 'A collaborative network for people empowerment.',
    mission: 'Empowering communities through shared projects.',
    city: 'Los Angeles',
    state: 'CA',
    isOfferingFunds: false,
    email: 'contact@peoplepowered.org',
    website: 'https://peoplepowered.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'Maria Fund',
    slug: 'maria-fund',
    description: 'Funding grassroots initiatives.',
    mission: 'Investing in community strengths.',
    city: 'Chicago',
    state: 'IL',
    isOfferingFunds: false,
    email: 'hello@mariafund.org',
    website: 'https://mariafund.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'Seed Commons',
    slug: 'seed-commons',
    description: 'A seed funding organization.',
    mission: 'Growing sustainable projects from the ground up.',
    city: 'Austin',
    state: 'TX',
    isOfferingFunds: false,
    email: 'info@seedcommons.org',
    website: 'https://seedcommons.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'CED',
    slug: 'CED',
    description: 'Center for Economic Development.',
    mission: 'Promoting equitable financial strategies.',
    city: 'Seattle',
    state: 'WA',
    isOfferingFunds: false,
    email: 'contact@ced.org',
    website: 'https://ced.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'Boston Ujima Projectew Economy Coalition',
    slug: 'boston-ujima-projectew-economy-coalition',
    description: 'Testing organization with an extended name.',
    mission: 'Expanding collaborative efforts.',
    city: 'Boston',
    state: 'MA',
    isOfferingFunds: false,
    email: 'info@bostonujima.org',
    website: 'https://bostonujima.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'People Powered',
    slug: 'people-powered',
    description: 'Second instance of People Powered.',
    mission: 'Expanding community-driven projects.',
    city: 'Denver',
    state: 'CO',
    isOfferingFunds: false,
    email: 'contact@peoplepowered.org',
    website: 'https://peoplepowered.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'Maria Fund',
    slug: 'maria-fund',
    description: 'Alternative branch of Maria Fund.',
    mission: 'Supporting creative community investments.',
    city: 'Miami',
    state: 'FL',
    isOfferingFunds: false,
    email: 'hello@mariafund.org',
    website: 'https://mariafund.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'Seed Commons',
    slug: 'seed-commons',
    description: 'Second branch of Seed Commons.',
    mission: 'Nurturing sustainable community projects.',
    city: 'Portland',
    state: 'OR',
    isOfferingFunds: false,
    email: 'info@seedcommons.org',
    website: 'https://seedcommons.org',
    type: OrgType.COMMONS,
  },
  {
    name: 'Boston Ujima Project',
    slug: 'boston-ujima-project',
    description: 'A local Boston project for community involvement.',
    mission: 'Driving neighborhood change through activism.',
    city: 'Boston',
    state: 'MA',
    isOfferingFunds: false,
    email: 'contact@bostonujima.org',
    website: 'https://bostonujima.org',
    type: OrgType.COMMONS,
  },
];

// setup mock organizations
await Promise.all(
  seedOrgs.map(data => db.insert(schema.organizations).values(data)),
);

await db.$client.end();
