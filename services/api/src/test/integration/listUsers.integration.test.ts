import { createOrganization } from '@op/common';
import { db } from '@op/db/client';
import { accessRoles, organizationUserToAccessRoles } from '@op/db/schema';
import { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';

import { organizationRouter } from '../../routers/organization';
import { createCallerFactory } from '../../trpcFactory';
import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

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
    // Clean up before each test (but NOT access_roles - those are needed by createOrganization)
    // await cleanupTestData([
    //   'organization_user_to_access_roles',
    //   'organization_users',
    //   'organizations_terms',
    //   'organizations_strategies',
    //   'organizations_where_we_work',
    //   'organizations',
    //   'profiles',
    //   'links',
    //   'locations',
    // ]);
    await signOutTestUser();

    // Ensure Admin role exists (required by createOrganization)
    await db
      .insert(accessRoles)
      .values({
        name: 'Admin',
        description: 'Administrator role with full permissions',
      })
      .onConflictDoNothing();

    // Create fresh test user for each test
    testUserEmail = `test-users-${Date.now()}@oneproject.org`;
    const lol = await createTestUser(testUserEmail);
    console.log('Created test user:', lol);
    const lul = await signInTestUser(testUserEmail);
    console.log('Signed in test user:', lul);

    // Get the authenticated user for service calls
    session = await getCurrentTestSession();
    testUser = session?.user;

    // Create a test organization
    const organizationData = {
      name: 'Test Organization for Users',
      website: 'https://test-users.org',
      email: 'contact@test-users.org',
      orgType: 'nonprofit',
      bio: 'A test organization for user management',
      mission: 'To test user listing functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const organization = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    organizationId = organization.id;
    profileId = organization.profile.id;

    // Create tRPC caller
    createCaller = createCallerFactory(organizationRouter);
  });

  it('should successfully list organization users with admin permissions', async () => {
    const caller = createCaller(createTestContext(session!.access_token));

    const result = await caller.listUsers({
      profileId: profileId,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Check the creator is in the list
    const creator = result.find((user) => user.authUserId === testUser.id);
    expect(creator).toBeDefined();
    expect(creator?.email).toBe(testUserEmail);
    expect(creator?.organizationId).toBe(organizationId);
    expect(Array.isArray(creator?.roles)).toBe(true);
    // Profile data should be included
    expect(creator?.profile).toBeDefined();
  });
});
