import { db } from '@op/db/client';
import {
  organizationUserToAccessRoles,
  organizationUsers,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { createServerClient } from '@supabase/ssr';
import { Session } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import {
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

// Determine the correct Supabase URL based on the test database
const isTestDatabase = process.env.DATABASE_URL?.includes('55322');
const supabaseUrl = isTestDatabase
  ? 'http://127.0.0.1:55321'
  : process.env.NEXT_PUBLIC_SUPABASE_URL!;

interface SeedUserInput {
  email: string;
  role: 'Admin' | 'Member' | 'Editor';
}

interface SeedForListUsersInput {
  organizationName?: string;
  users: SeedUserInput[];
}

interface SeedForListUsersOutput {
  organization: any;
  profileId: string;
  users: Array<{
    authUserId: string;
    email: string;
    organizationUserId: string;
  }>;
}

/**
 * Minimal seeding helper for listUsers tests.
 * Assumes access_zones, access_roles, and access_role_permissions_on_access_zones already exist.
 *
 * Usage:
 * const { profileId, users } = await seedForListUsers({
 *   organizationName: "Test Org",
 *   users: [
 *     { email: "admin@test.com", role: "Admin" },
 *     { email: "editor@test.com", role: "Editor" },
 *     { email: "member@test.com", role: "Member" },
 *   ]
 * });
 */
// @ts-ignore - Helper function for future tests
async function seedForListUsers(
  input: SeedForListUsersInput,
): Promise<SeedForListUsersOutput> {
  const { organizationName = `Test Org ${Date.now()}`, users: userInputs } =
    input;

  // 1. Create organization profile (minimal - only required fields)
  const [orgProfile] = await db
    .insert(profiles)
    .values({
      name: organizationName,
      slug: `${organizationName.toLowerCase().replace(/\s+/g, '-')}-${randomUUID()}`,
    })
    .returning();

  if (!orgProfile) {
    throw new Error('Failed to create organization profile');
  }

  // 2. Create organization (minimal - only required fields)
  const [organization] = await db
    .insert(organizations)
    .values({
      profileId: orgProfile.id,
    })
    .returning();

  if (!organization) {
    throw new Error('Failed to create organization');
  }

  const createdUsers: SeedForListUsersOutput['users'] = [];

  // 3. Create users and link them to the organization
  for (const userInput of userInputs) {
    const { email, role } = userInput;

    // Create auth user via Supabase Admin API
    const authUser = await createTestUser(email).then((res) => res.user);

    if (!authUser || !authUser.email) {
      throw new Error(`Failed to create auth user for ${email}`);
    }

    // Create user profile (minimal - only required fields)
    const username = email.split('@')[0] || 'user';
    const [userProfile] = await db
      .insert(profiles)
      .values({
        name: username,
        slug: `${username}-${randomUUID()}`,
      })
      .returning();

    if (!userProfile) {
      throw new Error(`Failed to create profile for ${email}`);
    }

    // Create user in users table (minimal - only required fields)
    await db
      .insert(users)
      .values({
        authUserId: authUser.id,
        email: authUser.email!,
      })
      .onConflictDoUpdate({
        target: [users.email],
        set: {
          authUserId: authUser.id,
        },
      });

    // Create organization user (minimal - only required fields)
    const [orgUser] = await db
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        authUserId: authUser.id,
        email: authUser.email,
      })
      .returning();

    if (!orgUser) {
      throw new Error(`Failed to create organization user for ${email}`);
    }

    // Get the role from access_roles
    // TODO: we should get it from seed data
    const accessRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, role),
    });

    if (!accessRole) {
      throw new Error(`Role ${role} not found in access_roles table`);
    }

    // Assign role to organization user
    await db.insert(organizationUserToAccessRoles).values({
      organizationUserId: orgUser.id,
      accessRoleId: accessRole.id,
    });

    createdUsers.push({
      authUserId: authUser.id,
      email: authUser.email!,
      organizationUserId: orgUser.id,
    });
  }

  return {
    organization,
    profileId: orgProfile.id,
    users: createdUsers,
  };
}

describe('List Organization Users Integration Tests', () => {
  let testUserEmail: string;
  let testUser: any;
  let organizationId: string;
  let profileId: string;
  let createCaller: ReturnType<typeof createCallerFactory>;
  let session: Session | null;

  const createTestContext = (jwt: string) => ({
    jwt,
    req: {
      headers: { get: () => '127.0.0.1' },
      url: 'http://localhost:3000/api/trpc',
    } as any,
    res: {} as any,
    ip: '127.0.0.1',
    reqUrl: 'http://localhost:3000/api/trpc',
    isServerSideCall: true, // Skip rate limiting in tests
    getCookies: () => ({}),
  });

  beforeEach(async () => {
    // Create fresh test user for each test
    testUserEmail = `test-users-${Date.now()}@oneproject.org`;

    // Use seedForListUsers to create organization and users
    const { organization, profileId: orgProfileId } = await seedForListUsers({
      organizationName: 'Test Organization for Users',
      users: [{ email: testUserEmail, role: 'Admin' }],
    });

    organizationId = organization.id;
    profileId = orgProfileId;

    // Sign in the test user
    await signOutTestUser();
    await signInTestUser(testUserEmail);
    session = await getCurrentTestSession();
    testUser = session?.user;

    // Create tRPC caller
    createCaller = createCallerFactory(organizationRouter);
  });

  it('should successfully list organization users', async () => {
    if (!session) {
      throw new Error('No session found for test user');
    }
    // @ts-expect-error - Test context uses simplified structure
    const caller = createCaller(createTestContext(session!.access_token));

    // @ts-expect-error - listUsers exists on the router
    const result = await caller.listUsers({
      profileId: profileId,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Check the creator is in the list
    const creator = result.find((user: any) => user.authUserId === testUser.id);
    expect(creator).toBeDefined();
    expect(creator?.email).toBe(testUserEmail);
    expect(creator?.organizationId).toBe(organizationId);
    expect(Array.isArray(creator?.roles)).toBe(true);
    // Profile data should be included
    expect(creator?.profile).toBeDefined();
  });
});
