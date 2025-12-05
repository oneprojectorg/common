import { db } from '@op/db/client';
import { locations, organizationsWhereWeWork, profiles } from '@op/db/schema';
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

      // Register cleanup for the created organization (not tracked by TestOrganizationDataManager)
      // Note: locations are a shared table and don't cascade delete when org is deleted
      onTestFinished(async () => {
        if (result.id) {
          // First, get location IDs linked to this organization before deleting
          const linkedLocations = await db
            .select({ locationId: organizationsWhereWeWork.locationId })
            .from(organizationsWhereWeWork)
            .where(eq(organizationsWhereWeWork.organizationId, result.id));

          const locationIds = linkedLocations.map((l) => l.locationId);

          // Delete the profile (cascades to organization and organizationsWhereWeWork)
          if (result.profile?.id) {
            await db.delete(profiles).where(eq(profiles.id, result.profile.id));
          }

          // Clean up orphaned locations
          if (locationIds.length > 0) {
            await db
              .delete(locations)
              .where(inArray(locations.id, locationIds));
          }
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
