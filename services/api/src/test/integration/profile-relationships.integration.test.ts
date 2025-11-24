import {
  addProfileRelationship,
  createOrganization,
  getProfileRelationships,
  removeProfileRelationship,
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

describe.skip('Profile Relationships Integration Tests', () => {
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

  describe('addProfileRelationship', () => {
    it('should successfully add a following relationship', async () => {
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(false);
      expect(relationships[0].createdAt).toBeDefined();
    });

    it('should successfully add a likes relationship', async () => {
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
      expect(relationships[0].pending).toBe(false);
    });

    it('should add a pending relationship when specified', async () => {
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(true);
    });

    it('should prevent self-relationships', async () => {
      await expect(
        addProfileRelationship({
          targetProfileId: profile1Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
          sourceProfileId: profile1Id,
          authUserId: testUser1.id,
        }),
      ).rejects.toThrow('You cannot create a relationship with yourself');
    });

    it('should handle duplicate relationships gracefully (onConflictDoNothing)', async () => {
      // Add the same relationship twice
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Should still only have one relationship
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should allow multiple different relationship types to the same profile', async () => {
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(2);

      const relationshipTypes = relationships.map((r) => r.relationshipType);
      expect(relationshipTypes).toContain(ProfileRelationshipType.FOLLOWING);
      expect(relationshipTypes).toContain(ProfileRelationshipType.LIKES);
    });
  });

  describe('removeProfileRelationship', () => {
    it('should successfully remove a following relationship', async () => {
      // First add a relationship
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Verify it exists
      let relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });
      expect(relationships).toHaveLength(1);

      // Remove it
      await removeProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        authUserId: testUser1.id,
      });

      // Verify it's gone
      relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });
      expect(relationships).toHaveLength(0);
    });

    it('should only remove the specified relationship type', async () => {
      // Add both relationship types
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Remove only the following relationship
      await removeProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        authUserId: testUser1.id,
      });

      // Verify only likes remains
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });
      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
    });

    it('should handle removing non-existent relationships gracefully', async () => {
      // Try to remove a relationship that doesn't exist
      await expect(
        removeProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          authUserId: testUser1.id,
        }),
      ).resolves.not.toThrow();

      // Verify no relationships exist
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });
      expect(relationships).toHaveLength(0);
    });
  });

  describe('getProfileRelationships', () => {
    it('should return empty array when no relationships exist', async () => {
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(0);
      expect(Array.isArray(relationships)).toBe(true);
    });

    it('should return all relationships with a profile', async () => {
      // Add multiple relationships
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: true,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
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
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Switch to User 2 and have them follow User 1
      await signInTestUser(testUserEmail2);
      await addProfileRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile2Id,
        authUserId: testUser2.id,
      });

      // User 2 should only see their relationship to User 1
      const user2Relationships = await getProfileRelationships({
        targetProfileId: profile1Id,
        sourceProfileId: profile2Id,
        authUserId: testUser2.id,
      });
      expect(user2Relationships).toHaveLength(1);
      expect(user2Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );

      // Switch back to User 1 and check they only see their relationship to User 2
      await signInTestUser(testUserEmail1);
      const user1Relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
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
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Switch to User 2 and have them also follow User 1
      await signInTestUser(testUserEmail2);
      await addProfileRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile2Id,
        authUserId: testUser2.id,
      });

      // User 2 likes User 1
      await addProfileRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile2Id,
        authUserId: testUser2.id,
      });

      // Check User 2's relationships to User 1
      const user2ToUser1 = await getProfileRelationships({
        targetProfileId: profile1Id,
        sourceProfileId: profile2Id,
        authUserId: testUser2.id,
      });
      expect(user2ToUser1).toHaveLength(2);

      const types = user2ToUser1.map((r) => r.relationshipType);
      expect(types).toContain(ProfileRelationshipType.FOLLOWING);
      expect(types).toContain(ProfileRelationshipType.LIKES);

      // Switch back to User 1 and check their relationships to User 2
      await signInTestUser(testUserEmail1);
      const user1ToUser2 = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });
      expect(user1ToUser2).toHaveLength(1);
      expect(user1ToUser2[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should maintain data integrity across user sessions', async () => {
      // User 1 adds a pending relationship
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Switch users multiple times
      await signInTestUser(testUserEmail2);
      await signInTestUser(testUserEmail1);

      // Verify the relationship still exists with correct data
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
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

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: individualProfileId,
        authUserId: testUser1.id,
      });

      // Verify the individual is following the organization
      const relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        sourceProfileId: individualProfileId,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(false);
    });

    it('should allow an individual to like an organization', async () => {
      await signInTestUser(testUserEmail1);

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
    });

    it('should support pending follow requests from individuals to organizations', async () => {
      // Individual sends a pending follow request to organization
      await signInTestUser(testUserEmail1);

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true, // Organization needs to approve
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(relationships[0].pending).toBe(true);

      // Simulate organization "approving" by removing and re-adding as non-pending
      await removeProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      const approvedRelationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
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

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: org3.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      // Verify individual is following first organization
      const org1Relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
      });
      expect(org1Relationships).toHaveLength(1);
      expect(org1Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );

      // Verify individual is following second organization
      const org3Relationships = await getProfileRelationships({
        targetProfileId: org3.profileId,
        authUserId: testUser1.id,
      });
      expect(org3Relationships).toHaveLength(1);
      expect(org3Relationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
    });

    it('should allow individuals to both follow and like the same organization', async () => {
      await signInTestUser(testUserEmail1);

      // Individual both follows and likes the organization
      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        authUserId: testUser1.id,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
      });

      expect(relationships).toHaveLength(2);

      const types = relationships.map((r) => r.relationshipType);
      expect(types).toContain(ProfileRelationshipType.FOLLOWING);
      expect(types).toContain(ProfileRelationshipType.LIKES);
    });

    it('should handle individual unfollowing an organization', async () => {
      // Individual follows organization first
      await signInTestUser(testUserEmail1);

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      // Verify relationship exists
      let relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
      });
      expect(relationships).toHaveLength(1);

      // Individual unfollows organization
      await removeProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        authUserId: testUser1.id,
      });

      // Verify relationship is removed
      relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
      });
      expect(relationships).toHaveLength(0);
    });

    it('should maintain relationship history and timestamps for individual-org relationships', async () => {
      const beforeTime = new Date();

      await signInTestUser(testUserEmail1);

      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      const afterTime = new Date();

      const relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        authUserId: testUser1.id,
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
      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      await signInTestUser(testUserEmail3);
      await addProfileRelationship({
        targetProfileId: orgProfileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser3.id,
      });

      // Each individual should see their own relationship
      await signInTestUser(testUserEmail1);
      const individual1Relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        sourceProfileId: individualProfileId,
        authUserId: testUser1.id,
      });
      expect(individual1Relationships).toHaveLength(1);

      await signInTestUser(testUserEmail3);
      const individual2Relationships = await getProfileRelationships({
        targetProfileId: orgProfileId,
        sourceProfileId: individual2ProfileId,
        authUserId: testUser3.id,
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

      await addProfileRelationship({
        targetProfileId: nonprofitOrg.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: forProfitOrg.profileId,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        authUserId: testUser1.id,
      });

      // Verify both relationships exist
      const nonprofitRelationships = await getProfileRelationships({
        targetProfileId: nonprofitOrg.profileId,
        authUserId: testUser1.id,
      });
      expect(nonprofitRelationships).toHaveLength(1);

      const forProfitRelationships = await getProfileRelationships({
        targetProfileId: forProfitOrg.profileId,
        authUserId: testUser1.id,
      });
      expect(forProfitRelationships).toHaveLength(1);
    });
  });

  describe('getProfileRelationships filtering', () => {
    it('should filter relationships by relationshipType', async () => {
      // Add both relationship types
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Filter for only following relationships
      const followingRelationships = await getProfileRelationships({
        sourceProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        authUserId: testUser1.id,
      });

      expect(followingRelationships).toHaveLength(1);
      expect(followingRelationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );

      // Filter for only likes relationships
      const likesRelationships = await getProfileRelationships({
        sourceProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.LIKES,
        authUserId: testUser1.id,
      });

      expect(likesRelationships).toHaveLength(1);
      expect(likesRelationships[0].relationshipType).toBe(
        ProfileRelationshipType.LIKES,
      );
    });

    it('should filter relationships by profileType', async () => {
      // This test will fail initially since profileType filtering is not implemented yet
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Filter for only org relationships
      const orgRelationships = await getProfileRelationships({
        sourceProfileId: profile1Id,
        profileType: 'org',
        authUserId: testUser1.id,
      });

      expect(orgRelationships).toHaveLength(1);
      expect(orgRelationships[0].targetProfile?.type).toBe('org');
    });

    it('should filter relationships by both relationshipType and profileType', async () => {
      // Add multiple relationships
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
        sourceProfileId: profile1Id,
        authUserId: testUser1.id,
      });

      // Filter for following relationships to orgs
      const filteredRelationships = await getProfileRelationships({
        sourceProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        profileType: 'org',
        authUserId: testUser1.id,
      });

      expect(filteredRelationships).toHaveLength(1);
      expect(filteredRelationships[0].relationshipType).toBe(
        ProfileRelationshipType.FOLLOWING,
      );
      expect(filteredRelationships[0].targetProfile?.type).toBe('org');
    });
  });
});
