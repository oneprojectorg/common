import { db } from '@op/db/client';
import {
  locations,
  organizationsStrategies,
  organizationsTerms,
  profiles,
  taxonomyTerms,
} from '@op/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { organizationRouter } from '.';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

describe.concurrent('Organization Integration Tests', () => {
  const createCaller = createCallerFactory(organizationRouter);

  describe('createOrganization', () => {
    it('should create organization with all metadata (profile, funding, locations, domain)', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createOrganization({
        users: { admin: 1 },
      });

      // Create isolated session for this test
      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const organizationData = {
        name: 'Test Organization',
        website: 'https://test-org.com/about?ref=test',
        email: 'contact@test-org.com',
        orgType: 'nonprofit' as const,
        bio: 'A test organization for integration testing',
        mission: 'To test organization creation functionality',
        networkOrganization: false,
        isReceivingFunds: true,
        isOfferingFunds: true,
        acceptingApplications: true,
        receivingFundsDescription: 'We accept grants for community projects',
        receivingFundsLink: 'https://test-org.com/apply',
        offeringFundsDescription: 'We offer micro-grants to local nonprofits',
        offeringFundsLink: 'https://test-org.com/grants',
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

      const result = await caller.create(organizationData);

      // Verify basic profile fields
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.profile).toBeDefined();

      if (!result.profile) {
        throw new Error('Profile should be defined');
      }

      expect(result.profile.name).toBe(organizationData.name);
      expect(result.profile.email).toBe(organizationData.email);
      expect(result.profile.website).toBe(organizationData.website);
      expect(result.profile.bio).toBe(organizationData.bio);
      expect(result.profile.mission).toBe(organizationData.mission);
      expect(result.orgType).toBe(organizationData.orgType);
      expect(result.networkOrganization).toBe(false);

      // Verify domain extraction from website URL
      expect(result.domain).toBe('test-org.com');

      // Verify funding flags
      expect(result.isReceivingFunds).toBe(true);
      expect(result.isOfferingFunds).toBe(true);
      expect(result.acceptingApplications).toBe(true);

      // Fetch full organization to verify all related data was created
      const orgFromDb = await caller.getBySlug({
        slug: result.profile.slug,
      });

      expect(orgFromDb).toBeDefined();
      expect(orgFromDb.profile.name).toBe(organizationData.name);

      // Verify funding links were created
      expect(orgFromDb.links.length).toBeGreaterThanOrEqual(2);

      const receivingLink = orgFromDb.links.find(
        (link) => link.type === 'receiving',
      );
      const offeringLink = orgFromDb.links.find(
        (link) => link.type === 'offering',
      );

      if (!receivingLink || !offeringLink) {
        throw new Error('Funding links should be defined');
      }

      expect(receivingLink.href).toBe(organizationData.receivingFundsLink);
      expect(receivingLink.description).toBe(
        organizationData.receivingFundsDescription,
      );
      expect(offeringLink.href).toBe(organizationData.offeringFundsLink);
      expect(offeringLink.description).toBe(
        organizationData.offeringFundsDescription,
      );

      // Verify location was created and linked
      expect(orgFromDb.whereWeWork).toHaveLength(1);
      const location = orgFromDb.whereWeWork[0];
      if (!location) {
        throw new Error('Location should be defined');
      }
      expect(location.name).toBe('San Francisco, CA');
      expect(location.countryCode).toBe('US');

      // Register cleanup for the created organization and locations (not tracked by TestOrganizationDataManager)
      const locationIds = orgFromDb.whereWeWork
        .map((loc) => loc.id)
        .filter((id): id is string => id !== undefined);
      onTestFinished(async () => {
        if (result.profile?.id) {
          await db.delete(profiles).where(eq(profiles.id, result.profile.id));
        }
        // Clean up locations (shared table, not cascade deleted)
        if (locationIds.length > 0) {
          await db.delete(locations).where(inArray(locations.id, locationIds));
        }
      });
    });

    it('should fail with invalid input data', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createOrganization({
        users: { admin: 1 },
      });

      // Create isolated session for this test
      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const invalidData = {
        name: '', // Empty name should fail validation
        website: 'invalid-url', // Invalid URL format
        email: 'invalid-email', // Invalid email format
        orgType: 'nonprofit' as const,
        bio: 'Test bio',
        mission: 'Test mission',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      };

      await expect(() => caller.create(invalidData)).rejects.toThrow();
    });

    it('should persist strategies and focus areas', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createOrganization({
        users: { admin: 1 },
      });

      const seededTerms = await db
        .select({ id: taxonomyTerms.id })
        .from(taxonomyTerms)
        .limit(2);
      const [strategyTerm, focusTerm] = seededTerms;
      if (!strategyTerm || !focusTerm) {
        throw new Error(
          'Expected at least 2 seeded taxonomy terms; check test DB seed',
        );
      }

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const result = await caller.create({
        name: `Strategies Test Org ${task.id}`,
        website: 'https://strategies-test.example.com',
        email: 'contact@strategies-test.example.com',
        orgType: 'nonprofit' as const,
        bio: 'Strategies test',
        mission: 'Strategies test',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
        strategies: [{ id: strategyTerm.id, label: 'Test Strategy' }],
        focusAreas: [{ id: focusTerm.id, label: 'Test Focus' }],
      });

      const strategyRows = await db
        .select()
        .from(organizationsStrategies)
        .where(eq(organizationsStrategies.organizationId, result.id));
      expect(strategyRows).toHaveLength(1);
      expect(strategyRows[0]?.taxonomyTermId).toBe(strategyTerm.id);

      const termRows = await db
        .select()
        .from(organizationsTerms)
        .where(eq(organizationsTerms.organizationId, result.id));
      expect(termRows).toHaveLength(1);
      expect(termRows[0]?.taxonomyTermId).toBe(focusTerm.id);

      onTestFinished(async () => {
        if (result.profile?.id) {
          await db.delete(profiles).where(eq(profiles.id, result.profile.id));
        }
      });
    });

    it('should roll back all inserts when a downstream insert fails', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createOrganization({
        users: { admin: 1 },
      });

      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const orgName = `Rollback Test Org ${task.id}`;
      const fakeTaxonomyTermId = '00000000-0000-0000-0000-000000000000';

      await expect(() =>
        caller.create({
          name: orgName,
          website: 'https://rollback-test.example.com',
          email: 'contact@rollback-test.example.com',
          orgType: 'nonprofit' as const,
          bio: 'Rollback test',
          mission: 'Rollback test',
          networkOrganization: false,
          isReceivingFunds: false,
          isOfferingFunds: false,
          acceptingApplications: false,
          strategies: [{ id: fakeTaxonomyTermId, label: 'fake' }],
        }),
      ).rejects.toThrow();

      // The transaction should have rolled back the profile, organization,
      // organizationUser, and role-grant rows that were inserted before the
      // failing strategies insert. Verify by name (uniqueness comes from the
      // task-id suffix above).
      const orphanProfiles = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.name, orgName));
      expect(orphanProfiles).toHaveLength(0);
    });
  });

  describe('getOrganization', () => {
    it('should retrieve organization by slug', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, organizationProfile, adminUser } =
        await testData.createOrganization({
          users: { admin: 1 },
          organizationName: 'Get By Slug Test',
        });

      // Create isolated session for this test
      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      const orgFromDb = await caller.getBySlug({
        slug: organizationProfile.slug,
      });

      expect(orgFromDb).toBeDefined();
      expect(orgFromDb.id).toBe(organization.id);
      expect(orgFromDb.profile.slug).toBe(organizationProfile.slug);
    });

    it('should throw error for non-existent organization slug', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { adminUser } = await testData.createOrganization({
        users: { admin: 1 },
      });

      // Create isolated session for this test
      const { session } = await createIsolatedSession(adminUser.email);
      const caller = createCaller(await createTestContextWithSession(session));

      await expect(() =>
        caller.getBySlug({ slug: 'non-existent-org-slug' }),
      ).rejects.toThrow();
    });
  });
});
