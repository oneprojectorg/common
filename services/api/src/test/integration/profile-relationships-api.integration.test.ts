import {
  createOrganization,
  addProfileRelationship,
  getProfileRelationships,
  removeProfileRelationship,
  ValidationError,
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

describe('Profile Relationships API Error Handling', () => {
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

    // Create first test user and organization
    testUserEmail1 = `test-user1-${Date.now()}@example.com`;
    await createTestUser(testUserEmail1);
    await signInTestUser(testUserEmail1);
    
    const session1 = await getCurrentTestSession();
    testUser1 = session1?.user;

    const org1 = await createOrganization({
      data: {
        name: 'API Test Organization 1',
        website: 'https://api1.org',
        email: 'contact@api1.org',
        orgType: 'nonprofit',
        bio: 'A test organization for API profile relationships',
        mission: 'To test API profile relationships',
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
        name: 'API Test Organization 2',
        website: 'https://api2.org',
        email: 'contact@api2.org',
        orgType: 'nonprofit',
        bio: 'Another test organization for API profile relationships',
        mission: 'To test API profile relationships too',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser2,
    });
    profile2Id = org2.profileId;

    // Default to first user context
    await signInTestUser(testUserEmail1);
  });

  describe('Validation and Error Handling', () => {
    it('should prevent self-relationships with clear error message', async () => {
      await expect(
        addProfileRelationship({
          targetProfileId: profile1Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        })
      ).rejects.toThrow('You cannot create a relationship with yourself');
    });

    it('should require authenticated user for adding relationships', async () => {
      await signOutTestUser();
      
      await expect(
        addProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        })
      ).rejects.toThrow();
    });

    it('should require authenticated user for removing relationships', async () => {
      await signOutTestUser();
      
      await expect(
        removeProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
        })
      ).rejects.toThrow();
    });

    it('should require authenticated user for getting relationships', async () => {
      await signOutTestUser();
      
      await expect(
        getProfileRelationships({
          targetProfileId: profile2Id,
        })
      ).rejects.toThrow();
    });
  });

  describe('Input Validation', () => {
    it('should handle invalid relationship types gracefully', async () => {
      // This would normally be caught by tRPC validation, but testing service robustness
      await expect(
        addProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: 'invalid_type' as any,
          pending: false,
        })
      ).rejects.toThrow();
    });

    it('should handle malformed profile IDs', async () => {
      await expect(
        addProfileRelationship({
          targetProfileId: 'not-a-uuid',
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain consistent data across user sessions', async () => {
      // User 1 adds a relationship
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true,
      });

      // Switch to user 2 and back to user 1
      await signInTestUser(testUserEmail2);
      await signInTestUser(testUserEmail1);

      // Verify relationship still exists with correct data
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe(ProfileRelationshipType.FOLLOWING);
      expect(relationships[0].pending).toBe(true);
      expect(relationships[0].createdAt).toBeDefined();
    });

    it('should handle concurrent relationships from different users', async () => {
      // User 1 follows User 2
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Switch to User 2 and have them follow User 1
      await signInTestUser(testUserEmail2);
      await addProfileRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Also have User 2 like User 1
      await addProfileRelationship({
        targetProfileId: profile1Id,
        relationshipType: ProfileRelationshipType.LIKES,
        pending: false,
      });

      // Check User 2's relationships to User 1
      const user2ToUser1 = await getProfileRelationships({
        targetProfileId: profile1Id,
      });
      expect(user2ToUser1).toHaveLength(2);
      
      const types = user2ToUser1.map(r => r.relationshipType);
      expect(types).toContain(ProfileRelationshipType.FOLLOWING);
      expect(types).toContain(ProfileRelationshipType.LIKES);

      // Switch back to User 1 and verify their relationships
      await signInTestUser(testUserEmail1);
      const user1ToUser2 = await getProfileRelationships({
        targetProfileId: profile2Id,
      });
      expect(user1ToUser2).toHaveLength(1);
      expect(user1ToUser2[0].relationshipType).toBe(ProfileRelationshipType.FOLLOWING);
    });

    it('should handle bulk operations correctly', async () => {
      // Add multiple relationships quickly
      await Promise.all([
        addProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        }),
        addProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.LIKES,
          pending: true,
        }),
      ]);

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });

      expect(relationships).toHaveLength(2);
      
      // Verify both relationships exist with correct pending status
      const following = relationships.find(r => r.relationshipType === ProfileRelationshipType.FOLLOWING);
      const likes = relationships.find(r => r.relationshipType === ProfileRelationshipType.LIKES);

      expect(following).toBeDefined();
      expect(following?.pending).toBe(false);
      
      expect(likes).toBeDefined();
      expect(likes?.pending).toBe(true);
    });

    it('should ensure unique constraint enforcement', async () => {
      // Add the same relationship multiple times
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      // Adding the same relationship should not create duplicates
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });

      expect(relationships).toHaveLength(1);
    });
  });

  describe('Relationship State Management', () => {
    it('should handle pending state transitions correctly', async () => {
      // Add a pending relationship
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: true,
      });

      let relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });
      expect(relationships[0].pending).toBe(true);

      // Remove and re-add as non-pending (simulating approval)
      await removeProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
      });

      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });
      expect(relationships[0].pending).toBe(false);
    });

    it('should maintain timestamp integrity', async () => {
      const beforeTime = new Date().toISOString();
      
      await addProfileRelationship({
        targetProfileId: profile2Id,
        relationshipType: ProfileRelationshipType.FOLLOWING,
        pending: false,
      });

      const afterTime = new Date().toISOString();

      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });

      expect(relationships[0].createdAt).toBeDefined();
      
      const createdAt = new Date(relationships[0].createdAt!).toISOString();
      expect(createdAt >= beforeTime).toBe(true);
      expect(createdAt <= afterTime).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid add/remove cycles', async () => {
      // Rapidly add and remove relationships
      for (let i = 0; i < 5; i++) {
        await addProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        });

        await removeProfileRelationship({
          targetProfileId: profile2Id,
          relationshipType: ProfileRelationshipType.FOLLOWING,
        });
      }

      // Should end with no relationships
      const relationships = await getProfileRelationships({
        targetProfileId: profile2Id,
      });
      expect(relationships).toHaveLength(0);
    });

    it('should handle operations on non-existent profiles gracefully', async () => {
      const fakeProfileId = '00000000-0000-0000-0000-000000000000';
      
      // These should not throw errors but may fail silently or with specific errors
      await expect(
        addProfileRelationship({
          targetProfileId: fakeProfileId,
          relationshipType: ProfileRelationshipType.FOLLOWING,
          pending: false,
        })
      ).rejects.toThrow();
    });
  });
});