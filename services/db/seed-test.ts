import { createServerClient } from '@supabase/ssr';
import dotenv from 'dotenv';
import { reset } from 'drizzle-seed';
import { sql } from 'drizzle-orm';

import { db } from '.';
import * as schema from './schema';
import {
  ACCESS_ROLES,
  ACCESS_ROLE_PERMISSIONS,
  ACCESS_ZONES,
} from './seedData/accessControl';

// Reserved UUIDs / emails for the two "role-bearer" global users. Kept in
// sync with packages/common/src/services/access/globalUser.ts — duplicated
// here because @op/db cannot depend on @op/common.
const GLOBAL_USER_PUBLIC_ID = '00000000-0000-4000-8000-000000000020';
const GLOBAL_USER_ANONYMOUS_ID = '00000000-0000-4000-8000-000000000021';
const GLOBAL_USER_PUBLIC_EMAIL = 'global-public@oneproject.internal';
const GLOBAL_USER_ANONYMOUS_EMAIL = 'global-anonymous@oneproject.internal';

/**
 * Decision templates for seeding.
 * NOTE: This is a copy of the template from @op/common to avoid circular dependency.
 * If templates change in @op/common, update this copy as well.
 */
const simpleVoting = {
  id: 'simple',
  version: '1.0.0',
  name: 'Simple Voting',
  description:
    'Basic approval voting where members vote for multiple proposals.',

  proposalTemplate: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Proposal title',
        'x-format': 'short-text',
      },
      summary: {
        type: 'string',
        title: 'Proposal summary',
        'x-format': 'long-text',
      },
      budget: {
        type: 'object',
        title: 'Budget',
        'x-format': 'money',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', default: 'USD' },
        },
      },
    },
    'x-field-order': ['title', 'budget', 'summary'],
    required: ['title', 'summary'],
  },

  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-01' },
      },
      settings: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
          maxProposalsPerMember: {
            type: 'number',
            title: 'Maximum Proposals Per Member',
            description: 'How many proposals can each member submit?',
            minimum: 1,
            default: 3,
          },
        },
        ui: {
          budget: {
            'ui:widget': 'number',
            'ui:placeholder': '100000',
          },
          maxProposalsPerMember: {
            'ui:widget': 'number',
            'ui:placeholder': '3',
          },
        },
      },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      description: 'Reviewers evaluate and shortlist proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-02' },
      },
      settings: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
        },
        ui: {
          budget: {
            'ui:widget': 'number',
            'ui:placeholder': '100000',
          },
        },
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'date', endDate: '2026-01-03' },
      },
      settings: {
        type: 'object',
        required: ['maxVotesPerMember'],
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
          maxVotesPerMember: {
            type: 'number',
            title: 'Maximum Votes Per Member',
            description: 'How many proposals can each member vote for?',
            minimum: 1,
            default: 3,
          },
        },
        ui: {
          budget: {
            'ui:widget': 'number',
            'ui:placeholder': '100000',
          },
          maxVotesPerMember: {
            'ui:widget': 'number',
            'ui:placeholder': '5',
          },
        },
      },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [
          {
            id: 'sort-by-likes',
            type: 'sort',
            name: 'Sort by likes count',
            sortBy: [{ field: 'voteData.likesCount', order: 'desc' }],
          },
          {
            id: 'limit-by-votes',
            type: 'limit',
            name: 'Take top N (based on maxVotesPerMember config)',
            count: { variable: 'maxVotesPerMember' },
          },
        ],
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'View final results and winning proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-04' },
      },
      settings: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
        },
        ui: {
          budget: {
            'ui:widget': 'number',
            'ui:placeholder': '100000',
          },
        },
      },
    },
  ],
};

const decisionTemplates = {
  simple: simpleVoting,
};

// For local development, we need to load the .env.local file from the root of the monorepo
dotenv.config({
  override: true,
});

if (!process.env.DB_SEEDING) {
  throw new Error('You must set DB_SEEDING to "true" when truncating');
}

const allowedDatabaseUrls = [
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres', // Development database
  'postgresql://postgres:postgres@127.0.0.1:55322/postgres', // Test database
  'postgresql://postgres:postgres@127.0.0.1:56322/postgres', // E2E database
];

if (!allowedDatabaseUrls.includes(process.env.DATABASE_URL || '')) {
  throw new Error('You are truncating in production');
}

// Determine the correct Supabase URL based on the database URL
function getSupabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (dbUrl.includes('56322')) {
    return 'http://127.0.0.1:56321'; // E2E Supabase instance
  }
  if (dbUrl.includes('55322')) {
    return 'http://127.0.0.1:55321'; // Test Supabase instance
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'; // Dev instance
}
const supabaseUrl = getSupabaseUrl();

const supabase = createServerClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE!,
  {
    cookieOptions: {},
    cookies: {
      getAll: async () => [],
      setAll: async () => {},
    },
  },
);

/**
 * Ensures a storage bucket exists, creating it if necessary
 */
async function ensureBucket(name: string): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === name);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(name, {
      public: true,
    });
    if (error) {
      console.warn(`  ⚠ Warning creating ${name} bucket:`, error.message);
    } else {
      console.log(`  ✓ Created ${name} bucket`);
    }
  } else {
    // Bucket exists, empty it
    const { error } = await supabase.storage.emptyBucket(name);
    if (error) {
      console.warn(`  ⚠ Warning emptying ${name} bucket:`, error.message);
    } else {
      console.log(`  ✓ Emptied ${name} bucket`);
    }
  }
}

/**
 * Wipe database tables and empty storage buckets
 */
async function wipeDatabase() {
  console.log('🧹 Wiping database before seeding...');

  // Use drizzle-seed reset function to truncate all tables
  await reset(db, schema);

  console.log('✅ Database wipe completed\n');

  // Ensure storage buckets exist and are empty
  await ensureBucket('assets');
  await ensureBucket('avatars');
}

/**
 * Seed access control data including zones, roles, and permissions
 */
async function seedAccessControl() {
  console.log('🔐 Seeding access control data (zones, roles, permissions)...');

  const { accessZones, accessRoles, accessRolePermissionsOnAccessZones } =
    schema;

  // Seed access zones using predefined constants
  const insertedZones = await db
    .insert(accessZones)
    .values(ACCESS_ZONES)
    .returning();
  console.log(`  ✓ Inserted ${insertedZones.length} access zones`);

  // Seed access roles using predefined constants
  const insertedRoles = await db
    .insert(accessRoles)
    .values(ACCESS_ROLES)
    .returning();
  console.log(`  ✓ Inserted ${insertedRoles.length} access roles`);

  // Seed access role permissions on access zones using predefined constants
  await db
    .insert(accessRolePermissionsOnAccessZones)
    .values(ACCESS_ROLE_PERMISSIONS);
  console.log(
    `  ✓ Inserted ${ACCESS_ROLE_PERMISSIONS.length} role permissions on access zones`,
  );
}

/**
 * Seed the two "role-bearer" global users — one for no-JWT callers
 * (GLOBAL_USER_PUBLIC) and one for Supabase-anonymous callers
 * (GLOBAL_USER_ANONYMOUS). The standard `create_user_on_signup` trigger
 * fires on the auth.users insert, creating the matching public.users +
 * profiles rows.
 *
 * Inserts are direct SQL into auth.users so we can pin the IDs to the
 * reserved UUIDs that the access-resolution layer hard-codes. Supabase's
 * admin API doesn't expose a way to choose the ID, hence the raw insert.
 *
 * Idempotent against repeat runs: ON CONFLICT (id) DO NOTHING. The
 * preceding `wipeDatabase()` reset only touches the public schema, so
 * auth.users persists across reseeds — repeat runs are no-ops for these
 * two rows and the profiles already exist.
 */
async function seedGlobalUsers() {
  console.log('👤 Seeding global role-bearer users...');

  // wipeDatabase() only resets public schema, so any prior auth.users
  // rows for these globals survive. Delete them so the INSERT below
  // re-fires the create_user_on_signup trigger and rebuilds the linked
  // public.users + profile rows wipe just removed.
  await db.execute(sql`
    DELETE FROM auth.users
    WHERE id IN (
      ${GLOBAL_USER_PUBLIC_ID}::uuid,
      ${GLOBAL_USER_ANONYMOUS_ID}::uuid
    )
  `);

  await db.execute(sql`
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES
      (
        ${GLOBAL_USER_PUBLIC_ID}::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        ${GLOBAL_USER_PUBLIC_EMAIL},
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      ),
      (
        ${GLOBAL_USER_ANONYMOUS_ID}::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        ${GLOBAL_USER_ANONYMOUS_EMAIL},
        '',
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now()
      )
  `);

  console.log(`  ✓ Seeded GLOBAL_USER_PUBLIC + GLOBAL_USER_ANONYMOUS`);
}

async function seedDecisionTemplates() {
  console.log('🧩 Seeding decision process templates...');

  const { profiles, decisionProcesses } = schema;

  const [ownerProfile] = await db
    .insert(profiles)
    .values({
      name: 'Decision Template Library',
      slug: 'decision-template-library',
    })
    .returning();

  if (!ownerProfile) {
    throw new Error('Failed to create decision template owner profile');
  }

  const templates = Object.values(decisionTemplates);

  if (!templates.length) {
    console.log('  ⚠ No decision templates found to seed');
    return;
  }

  const insertedTemplates = await db
    .insert(decisionProcesses)
    .values(
      templates.map((template) => ({
        name: template.name,
        description: template.description,
        processSchema: template,
        createdByProfileId: ownerProfile.id,
      })),
    )
    .returning();

  console.log(`  ✓ Inserted ${insertedTemplates.length} decision templates`);
}

/**
 * Main seed function that orchestrates all seeding operations
 */
async function seed() {
  console.log('🌱 Starting database seeding...\n');

  await wipeDatabase();
  await seedAccessControl();
  await seedGlobalUsers();
  await seedDecisionTemplates();

  console.log('\n✅ Database seeding completed successfully!');
}

// Execute seed function
await seed();
await db.$client.end();
