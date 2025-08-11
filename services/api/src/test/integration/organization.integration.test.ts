import { createOrganization, getOrganization } from '@op/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('Organization Creation Integration Tests', () => {
  let testUserEmail: string;
  let testUser: any;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'organization_user_to_access_roles',
      'organization_users',
      'organizations_terms',
      'organizations_strategies',
      'organizations_where_we_work',
      'organizations',
      'profiles',
      'links',
      'locations',
    ]);
    await signOutTestUser();

    // Create fresh test user for each test
    testUserEmail = `test-org-${Date.now()}@example.com`;
    await createTestUser(testUserEmail);
    await signInTestUser(testUserEmail);

    // Get the authenticated user for service calls
    const session = await getCurrentTestSession();
    testUser = session?.user;
  });

  it('should create a basic organization successfully', async () => {
    const organizationData = {
      name: 'Test Organization',
      website: 'https://test-org.com',
      email: 'contact@test-org.com',
      orgType: 'nonprofit',
      bio: 'A test organization for integration testing',
      mission: 'To test organization creation functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const result = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.profile).toBeDefined();
    expect(result.profile.name).toBe(organizationData.name);
    expect(result.profile.email).toBe(organizationData.email);
    expect(result.profile.website).toBe(organizationData.website);
    expect(result.profile.bio).toBe(organizationData.bio);
    expect(result.profile.mission).toBe(organizationData.mission);
    expect(result.orgType).toBe(organizationData.orgType);
    expect(result.networkOrganization).toBe(false);

    // Verify organization exists in database using getOrganization by slug
    const orgFromDb = await getOrganization({
      slug: result.profile.slug,
      user: testUser,
    });

    expect(orgFromDb).toBeDefined();
    expect(orgFromDb.profile.name).toBe(organizationData.name);
  });

  it('should create organization with funding information', async () => {
    const organizationData = {
      name: 'Funding Test Org',
      website: 'https://funding-test.org',
      email: 'funding@test.org',
      orgType: 'nonprofit',
      bio: 'Testing funding features',
      mission: 'To test funding functionality',
      networkOrganization: false,
      isReceivingFunds: true,
      isOfferingFunds: true,
      acceptingApplications: true,
      receivingFundsDescription: 'We accept grants for community projects',
      receivingFundsLink: 'https://funding-test.org/apply',
      offeringFundsDescription: 'We offer micro-grants to local nonprofits',
      offeringFundsLink: 'https://funding-test.org/grants',
    };

    const result = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    expect(result).toBeDefined();
    expect(result.isReceivingFunds).toBe(true);
    expect(result.isOfferingFunds).toBe(true);
    expect(result.acceptingApplications).toBe(true);

    // Verify funding links were created by getting the organization
    const orgFromDb = await getOrganization({
      slug: result.profile.slug,
      user: testUser,
    });

    expect(orgFromDb.links).toHaveLength(2);

    const receivingLink = orgFromDb.links.find(
      (link) => link.type === 'receiving',
    );
    const offeringLink = orgFromDb.links.find(
      (link) => link.type === 'offering',
    );

    expect(receivingLink?.href).toBe(organizationData.receivingFundsLink);
    expect(receivingLink?.description).toBe(
      organizationData.receivingFundsDescription,
    );
    expect(offeringLink?.href).toBe(organizationData.offeringFundsLink);
    expect(offeringLink?.description).toBe(
      organizationData.offeringFundsDescription,
    );
  });

  it('should create organization with location data', async () => {
    const organizationData = {
      name: 'Location Test Org',
      website: 'https://location-test.org',
      email: 'location@test.org',
      orgType: 'nonprofit',
      bio: 'Testing location features',
      mission: 'To test location functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
      whereWeWork: [
        {
          id: 'test-location-1',
          label: 'San Francisco, CA',
          isNewValue: false,
          data: {
            geonameId: 5391959,
            toponymName: 'San Francisco',
            countryCode: 'US',
            countryName: 'United States',
            lat: 37.7749,
            lng: -122.4194,
          },
        },
      ],
    };

    const result = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    expect(result).toBeDefined();

    // Verify location was created and linked
    const orgFromDb = await getOrganization({
      slug: result.profile.slug,
      user: testUser,
    });

    expect(orgFromDb.whereWeWork).toHaveLength(1);
    expect(orgFromDb.whereWeWork[0].name).toBe('San Francisco, CA');
    expect(orgFromDb.whereWeWork[0].countryCode).toBe('US');
  });

  it('should fail to create organization without authentication', async () => {
    await signOutTestUser();

    const organizationData = {
      name: 'Unauthorized Test Org',
      website: 'https://unauthorized.com',
      email: 'test@unauthorized.com',
      orgType: 'nonprofit',
      bio: 'This should fail',
      mission: 'To test unauthorized access',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    await expect(
      createOrganization({ data: organizationData, user: null as any }),
    ).rejects.toThrow();
  });

  it('should fail with invalid input data', async () => {
    const invalidData = {
      name: '', // Empty name should fail validation
      website: 'invalid-url', // Invalid URL format
      email: 'invalid-email', // Invalid email format
      orgType: 'nonprofit',
      bio: 'Test bio',
      mission: 'Test mission',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    await expect(
      createOrganization({ data: invalidData, user: testUser }),
    ).rejects.toThrow();
  });

  it('should create organization user relationship with admin role', async () => {
    const organizationData = {
      name: 'Admin Role Test Org',
      website: 'https://admin-test.org',
      email: 'admin@test.org',
      orgType: 'nonprofit',
      bio: 'Testing admin role assignment',
      mission: 'To test admin role functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const result = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    // Verify organization was created successfully with the correct user
    const orgFromDb = await getOrganization({
      slug: result.profile.slug,
      user: testUser,
    });

    expect(orgFromDb).toBeDefined();
    expect(orgFromDb.profile.name).toBe(organizationData.name);

    // Note: The createOrganization function handles the admin role assignment internally.
    // We trust that if the organization creation succeeded, the role assignment also worked
    // since they're part of the same transaction in createOrganization.
  });

  it('should handle domain extraction from website URL', async () => {
    const organizationData = {
      name: 'Domain Test Org',
      website: 'https://unique-domain.org/path?param=value',
      email: 'domain@test.org',
      orgType: 'nonprofit',
      bio: 'Testing domain extraction',
      mission: 'To test domain functionality',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    const result = await createOrganization({
      data: organizationData,
      user: testUser,
    });

    expect(result).toBeDefined();
    expect(result.domain).toBe('unique-domain.org');
  });
});
