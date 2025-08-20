import {
  addRelationship,
  createOrganization,
  getRelationships,
  removeRelationship,
} from '@op/common';
import { ProfileRelationshipType } from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('Profile Relationships Integration Tests', () => {
  let testUserEmail1: string;
  let testUserEmail2: string;
  let testUser1: any;
  let testUser2: any;
  let profile1Id: string;
  let profile2Id: string;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'profile_relationships',
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

    // Create first test user and organization to get profile
    testUserEmail1 = `test-user1-${Date.now()}@example.com`;
    await createTestUser(testUserEmail1);
    await signInTestUser(testUserEmail1);

    const session1 = await getCurrentTestSession();
    testUser1 = session1?.user;

    const org1 = await createOrganization({
      data: {
        name: 'Profile Test Organization 1',
        website: 'https://profile1.org',
        email: 'contact@profile1.org',
        orgType: 'nonprofit',
        bio: 'A test organization for profile relationships',
        mission: 'To test profile relationships',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser1,
    });
    profile1Id = org1.profileId;

    // Create second test user and organization
    testUserEmail2 = `test-user2-${Date.now()}@example.com`;
    await createTestUser(testUserEmail2);
    await signInTestUser(testUserEmail2);

    const session2 = await getCurrentTestSession();
    testUser2 = session2?.user;

    const org2 = await createOrganization({
      data: {
        name: 'Profile Test Organization 2',
        website: 'https://profile2.org',
        email: 'contact@profile2.org',
        orgType: 'nonprofit',
        bio: 'Another test organization for profile relationships',
        mission: 'To test profile relationships too',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser2,
    });
    profile2Id = org2.profileId;

    // Sign back in as first user for tests
    await signInTestUser(testUserEmail1);
  });

  describe('addRelationship', () => {
    it('should successfully add a following relationship', async () => {
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(false);
      expect(relationships[0].createdAt).toBeDefined();
    });

    it('should successfully add a likes relationship', async () => {
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
      });

      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
      expect(relationships[0].pending).toBe(false);
    });

    it('should add a pending relationship when specified', async () => {
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true,
        sourceProfileId: profile1Id,
      });

      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(true);
    });

    it('should prevent self-relationships', async () => {
      await expect(
        addRelationship({
          targetProfileId: profile1Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
          sourceProfileId: profile1Id,
        }),
      ).rejects.toThrow('You cannot create a relationship with yourself');
    });

    it('should handle duplicate relationships gracefully (onConflictDoNothing)', async () => {
      // Add the same relationship twice
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      // Should still only have one relationship
      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should allow multiple different relationship types to the same profile', async () => {
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
      });

      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(2);

      const relationshipTypes = relationships.map((r) => r.relationshipType);
      expect(relationshipTypes).toContain(ProfileRelationshipType.FOLLOWING);
      expect(relationshipTypes).toContain(ProfileRelationshipType.LIKES);
    });
  });

  describe('removeRelationship', () => {
    it('should successfully remove a following relationship', async () => {
      // First add a relationship
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      // Verify it exists
      let relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });
      expect(relationships).toHaveLength(1);

      // Remove it
      await removeRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        sourceProfileId: profile1Id,
      });

      // Verify it's gone
      relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });
      expect(relationships).toHaveLength(0);
    });

    it('should only remove the specified relationship type', async () => {
      // Add both relationship types
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
      });

      // Remove only the following relationship
      await removeRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        sourceProfileId: profile1Id,
      });

      // Verify only likes remains
      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });
      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
    });

    it('should handle removing non-existent relationships gracefully', async () => {
      // Try to remove a relationship that doesn't exist
      await expect(
        removeRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          sourceProfileId: profile1Id,
        }),
      ).resolves.not.toThrow();

      // Verify no relationships exist
      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });
      expect(relationships).toHaveLength(0);
    });
  });

  describe('getRelationships', () => {
    it('should return empty array when no relationships exist', async () => {
      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(0);
      expect(Array.isArray(relationships)).toBe(true);
    });

    it('should return all relationships with a profile', async () => {
      // Add multiple relationships
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: true,
        sourceProfileId: profile1Id,
      });

      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(2);

      // Find each relationship type
      const followingRel = relationships.find(
        (r) => r.relationshipType === ProfileRelationshipType.FOLLOWING,
      );
      const likesRel = relationships.find(
        (r) => r.relationshipType === ProfileRelationshipType.LIKES,
      );

      expect(followingRel).toBeDefined();
      expect(followingRel?.pending).toBe(false);
      expect(followingRel?.createdAt).toBeDefined();

      expect(likesRel).toBeDefined();
      expect(likesRel?.pending).toBe(true);
      expect(likesRel?.createdAt).toBeDefined();
    });

    it('should only return relationships from current user to target profile', async () => {
      // User 1 follows User 2
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      // Switch to User 2 and have them follow User 1
      await signInTestUser(testUserEmail2);
      await addRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile2Id,
      });

      // User 2 should only see their relationship to User 1
      const user2Relationships = await getRelationships({
        targetProfileId: profile1Id,
        sourceProfileId: profile2Id,
      });
      expect(user2Relationships).toHaveLength(1);
      expect(user2Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );

      // Switch back to User 1 and check they only see their relationship to User 2
      await signInTestUser(testUserEmail1);
      const user1Relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });
      expect(user1Relationships).toHaveLength(1);
      expect(user1Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });
  });

  describe('Cross-user scenarios', () => {
    it('should handle relationships from both directions independently', async () => {
      // User 1 follows User 2
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
      });

      // Switch to User 2 and have them also follow User 1
      await signInTestUser(testUserEmail2);
      await addRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile2Id,
      });

      // User 2 likes User 1
      await addRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile2Id,
      });

      // Check User 2's relationships to User 1
      const user2ToUser1 = await getRelationships({
        targetProfileId: profile1Id,
        sourceProfileId: profile2Id,
      });
      expect(user2ToUser1).toHaveLength(2);

      const types = user2ToUser1.map((r) => r.relationshipType);
      expect(types).toContain(ProfileRelationshipType.FOLLOWING);
      expect(types).toContain(ProfileRelationshipType.LIKES);

      // Switch back to User 1 and check their relationships to User 2
      await signInTestUser(testUserEmail1);
      const user1ToUser2 = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });
      expect(user1ToUser2).toHaveLength(1);
      expect(user1ToUser2[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should maintain data integrity across user sessions', async () => {
      // User 1 adds a pending relationship
      await addRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true,
        sourceProfileId: profile1Id,
      });

      // Switch users multiple times
      await signInTestUser(testUserEmail2);
      await signInTestUser(testUserEmail1);

      // Verify the relationship still exists with correct data
      const relationships = await getRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(true);
      expect(relationships[0].createdAt).toBeDefined();
    });
  });

  describe('Individual-to-Organization Relationships (Primary Use Case)', () => {
    let individualProfileId: string;
    let orgProfileId: string;
    let individualUser: any;
    let orgUser: any;

    beforeEach(async () => {
      // Create an individual user (User 1 will be the individual)
      // Already have testUser1 and profile1Id from beforeEach
      individualUser = testUser1;
      individualProfileId = profile1Id;

      // Update profile1 to be an individual type
      await signInTestUser(testUserEmail1);
      // Note: In a real scenario, you'd create an individual profile
      // For this test, we'll use the existing org profile as a proxy

      // User 2 will represent the organization
      orgUser = testUser2;
      orgProfileId = profile2Id;
    });

    it('should allow an individual to follow an organization', async () => {
      // Individual (User 1) follows Organization (User 2)
      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: individualProfileId,
      });

      // Verify the individual is following the organization
      const relationships = await getRelationships({
        targetProfileId: orgProfileId,
        sourceProfileId: individualProfileId,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(false);
    });

    it('should allow an individual to like an organization', async () => {
      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
      });

      const relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
    });

    it('should support pending follow requests from individuals to organizations', async () => {
      // Individual sends a pending follow request to organization
      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true, // Organization needs to approve
      });

      const relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(true);

      // Simulate organization "approving" by removing and re-adding as non-pending
      await removeRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
      });

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      const approvedRelationships = await getRelationships({
        targetProfileId: orgProfileId,
      });

      expect(approvedRelationships).toHaveLength(1);
      expect(approvedRelationships[0].pending).toBe(false);
    });

    it('should allow individuals to follow multiple organizations', async () => {
      // Create a third organization for testing multiple follows
      await signInTestUser(testUserEmail2);
      const org3 = await createOrganization({
        data: {
          name: 'Third Test Organization',
          website: 'https://org3.org',
          email: 'contact@org3.org',
          orgType: 'nonprofit',
          bio: 'A third organization for testing',
          mission: 'To be the third org',
          networkOrganization: false,
          isReceivingFunds: false,
          isOfferingFunds: false,
          acceptingApplications: false,
        },
        user: testUser2,
      });

      // Individual follows both organizations
      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      await addRelationship({
        targetProfileId: org3.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Verify individual is following first organization
      const org1Relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });
      expect(org1Relationships).toHaveLength(1);
      expect(org1Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );

      // Verify individual is following second organization
      const org3Relationships = await getRelationships({
        targetProfileId: org3.profileId,
      });
      expect(org3Relationships).toHaveLength(1);
      expect(org3Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should allow individuals to both follow and like the same organization', async () => {
      await signInTestUser(testUserEmail1);

      // Individual both follows and likes the organization
      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
      });

      const relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });

      expect(relationships).toHaveLength(2);

      const types = relationships.map((r) => r.relationshipType);
      expect(types).toContain(ProfileRelationshipType.FOLLOWING);
      expect(types).toContain(ProfileRelationshipType.LIKES);
    });

    it('should handle individual unfollowing an organization', async () => {
      // Individual follows organization first
      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Verify relationship exists
      let relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });
      expect(relationships).toHaveLength(1);

      // Individual unfollows organization
      await removeRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
      });

      // Verify relationship is removed
      relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });
      expect(relationships).toHaveLength(0);
    });

    it('should maintain relationship history and timestamps for individual-org relationships', async () => {
      const beforeTime = new Date();

      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      const afterTime = new Date();

      const relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].createdAt).toBeDefined();

      const createdAt = new Date(relationships[0].createdAt!);
      expect(createdAt >= beforeTime).toBe(true);
      expect(createdAt <= afterTime).toBe(true);
    });

    it('should handle scenarios where multiple individuals follow the same organization', async () => {
      // Create another individual user
      const testUserEmail3 = `test-user3-${Date.now()}@example.com`;
      await createTestUser(testUserEmail3);
      await signInTestUser(testUserEmail3);

      const session3 = await getCurrentTestSession();
      const testUser3 = session3?.user;

      const org3 = await createOrganization({
        data: {
          name: 'Individual User Organization',
          website: 'https://individual.org',
          email: 'contact@individual.org',
          orgType: 'nonprofit',
          bio: 'Organization for an individual user',
          mission: 'To represent an individual',
          networkOrganization: false,
          isReceivingFunds: false,
          isOfferingFunds: false,
          acceptingApplications: false,
        },
        user: testUser3,
      });
      const individual2ProfileId = org3.profileId;

      // Both individuals follow the same organization
      await signInTestUser(testUserEmail1);
      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      await signInTestUser(testUserEmail3);
      await addRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Each individual should see their own relationship
      await signInTestUser(testUserEmail1);
      const individual1Relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });
      expect(individual1Relationships).toHaveLength(1);

      await signInTestUser(testUserEmail3);
      const individual2Relationships = await getRelationships({
        targetProfileId: orgProfileId,
      });
      expect(individual2Relationships).toHaveLength(1);

      // Relationships should be independent
      expect(individual1Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(individual2Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should handle different organization types being followed by individuals', async () => {
      // Create organizations of different types
      await signInTestUser(testUserEmail2);

      const nonprofitOrg = await createOrganization({
        data: {
          name: 'Nonprofit Organization',
          website: 'https://nonprofit.org',
          email: 'contact@nonprofit.org',
          orgType: 'nonprofit',
          bio: 'A nonprofit organization',
          mission: 'To help people',
          networkOrganization: false,
          isReceivingFunds: true,
          isOfferingFunds: false,
          acceptingApplications: true,
        },
        user: testUser2,
      });

      const forProfitOrg = await createOrganization({
        data: {
          name: 'For-Profit Company',
          website: 'https://company.com',
          email: 'contact@company.com',
          orgType: 'forprofit',
          bio: 'A for-profit company',
          mission: 'To make money and help people',
          networkOrganization: false,
          isReceivingFunds: false,
          isOfferingFunds: true,
          acceptingApplications: false,
        },
        user: testUser2,
      });

      // Individual follows both types of organizations
      await signInTestUser(testUserEmail1);

      await addRelationship({
        targetProfileId: nonprofitOrg.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      await addRelationship({
        targetProfileId: forProfitOrg.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Verify both relationships exist
      const nonprofitRelationships = await getRelationships({
        targetProfileId: nonprofitOrg.profileId,
      });
      expect(nonprofitRelationships).toHaveLength(1);

      const forProfitRelationships = await getRelationships({
        targetProfileId: forProfitOrg.profileId,
      });
      expect(forProfitRelationships).toHaveLength(1);
    });
  });
});
