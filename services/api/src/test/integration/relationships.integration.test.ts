import {
  addRelationship,
  createOrganization,
  getDirectedRelationships,
} from '@op/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

describe('Organization Relationships Integration Tests', () => {
  let testUserEmail1: string;
  let testUserEmail2: string;
  let testUser1: any;
  let testUser2: any;
  let org1: any;
  let org2: any;
  let org3: any;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'organization_relationships',
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

    org1 = await createOrganization({
      data: {
        name: 'Funder Organization',
        website: 'https://funder.org',
        email: 'contact@funder.org',
        orgType: 'nonprofit',
        bio: 'A funding organization',
        mission: 'To provide funding',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: true,
        acceptingApplications: false,
      },
      user: testUser1,
    });

    // Create second test user and organization
    testUserEmail2 = `test-user2-${Date.now()}@example.com`;
    await createTestUser(testUserEmail2);
    await signInTestUser(testUserEmail2);

    const session2 = await getCurrentTestSession();
    testUser2 = session2?.user;

    org2 = await createOrganization({
      data: {
        name: 'Fundee Organization',
        website: 'https://fundee.org',
        email: 'contact@fundee.org',
        orgType: 'nonprofit',
        bio: 'A funded organization',
        mission: 'To receive funding',
        networkOrganization: false,
        isReceivingFunds: true,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser2,
    });

    // Create a third organization for testing multiple relationships
    org3 = await createOrganization({
      data: {
        name: 'Partner Organization',
        website: 'https://partner.org',
        email: 'contact@partner.org',
        orgType: 'nonprofit',
        bio: 'A partner organization',
        mission: 'To partner with others',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser2,
    });

    // Sign back in as first user for relationship tests
    await signInTestUser(testUserEmail1);
  });

  describe('Relationship Inversion', () => {
    it('should properly invert funding relationships when queried from opposite direction', async () => {
      // Add funding relationship from org1 to org2
      // org1 is funding org2
      await addRelationship({
        user: testUser1,
        from: org1.id,
        to: org2.id,
        relationships: ['funding'],
      });

      // Query from org1's perspective (source organization)
      // Don't filter by pending since relationships start as pending
      const org1Relationships = await getDirectedRelationships({
        user: testUser1,
        from: org1.id,
        pending: null,
      });

      // org1 should see org2 with 'funding' relationship (org1 is funding org2)
      expect(org1Relationships.records).toHaveLength(1);
      expect(org1Relationships.records[0].targetOrganizationId).toBe(org2.id);
      expect(org1Relationships.records[0].relationshipType).toBe('funding');

      // Now sign in as org2 and query from their perspective
      await signInTestUser(testUserEmail2);
      const session2 = await getCurrentTestSession();
      testUser2 = session2?.user;

      const org2Relationships = await getDirectedRelationships({
        user: testUser2,
        from: org2.id,
        pending: null,
      });

      // org2 should see org1 with 'fundedBy' relationship (org2 is funded by org1)
      expect(org2Relationships.records).toHaveLength(1);
      expect(org2Relationships.records[0].sourceOrganizationId).toBe(org2.id);
      expect(org2Relationships.records[0].targetOrganizationId).toBe(org1.id);
      expect(org2Relationships.records[0].relationshipType).toBe('fundedBy');
    });

    it('should properly handle bidirectional partnerships', async () => {
      // Add partnership relationship from org1 to org3
      await addRelationship({
        user: testUser1,
        from: org1.id,
        to: org3.id,
        relationships: ['partnership'],
      });

      // Query from org1's perspective
      const org1Relationships = await getDirectedRelationships({
        user: testUser1,
        from: org1.id,
        pending: null,
      });

      expect(org1Relationships.records).toHaveLength(1);
      expect(org1Relationships.records[0].targetOrganizationId).toBe(org3.id);
      expect(org1Relationships.records[0].relationshipType).toBe('partnership');

      // Sign in as org3 owner and query from their perspective
      await signInTestUser(testUserEmail2);
      const session2 = await getCurrentTestSession();
      testUser2 = session2?.user;

      const org3Relationships = await getDirectedRelationships({
        user: testUser2,
        from: org3.id,
        pending: null,
      });

      // org3 should also see 'partnership' since it's bidirectional
      expect(org3Relationships.records).toHaveLength(1);
      expect(org3Relationships.records[0].sourceOrganizationId).toBe(org3.id);
      expect(org3Relationships.records[0].targetOrganizationId).toBe(org1.id);
      expect(org3Relationships.records[0].relationshipType).toBe('partnership');
    });

    it('should properly invert memberOf/hasMember relationships', async () => {
      // org2 is a member of org1
      await signInTestUser(testUserEmail2);
      const session2 = await getCurrentTestSession();
      testUser2 = session2?.user;

      await addRelationship({
        user: testUser2,
        from: org2.id,
        to: org1.id,
        relationships: ['memberOf'],
      });

      // Query from org2's perspective (they are a member)
      const org2Relationships = await getDirectedRelationships({
        user: testUser2,
        from: org2.id,
        pending: null,
      });

      expect(org2Relationships.records).toHaveLength(1);
      expect(org2Relationships.records[0].targetOrganizationId).toBe(org1.id);
      expect(org2Relationships.records[0].relationshipType).toBe('memberOf');

      // Sign in as org1 and query from their perspective
      await signInTestUser(testUserEmail1);
      const session1 = await getCurrentTestSession();
      testUser1 = session1?.user;

      const org1Relationships = await getDirectedRelationships({
        user: testUser1,
        from: org1.id,
        pending: null,
      });

      // org1 should see 'hasMember' relationship (they have org2 as a member)
      expect(org1Relationships.records).toHaveLength(1);
      expect(org1Relationships.records[0].sourceOrganizationId).toBe(org1.id);
      expect(org1Relationships.records[0].targetOrganizationId).toBe(org2.id);
      expect(org1Relationships.records[0].relationshipType).toBe('hasMember');
    });

    it('should handle multiple relationships between organizations', async () => {
      // Add multiple relationship types between org1 and org2
      await addRelationship({
        user: testUser1,
        from: org1.id,
        to: org2.id,
        relationships: ['funding', 'partnership'],
      });

      // Query from org1's perspective
      const org1Relationships = await getDirectedRelationships({
        user: testUser1,
        from: org1.id,
        to: org2.id,
        pending: null,
      });

      // Should have 2 relationship records
      expect(org1Relationships.records).toHaveLength(2);

      const relationshipTypes = org1Relationships.records.map(r => r.relationshipType);
      expect(relationshipTypes).toContain('funding');
      expect(relationshipTypes).toContain('partnership');

      // Sign in as org2 and query from their perspective
      await signInTestUser(testUserEmail2);
      const session2 = await getCurrentTestSession();
      testUser2 = session2?.user;

      const org2Relationships = await getDirectedRelationships({
        user: testUser2,
        from: org2.id,
        to: org1.id,
        pending: null,
      });

      // Should also have 2 relationship records, properly inverted
      expect(org2Relationships.records).toHaveLength(2);

      const invertedTypes = org2Relationships.records.map(r => r.relationshipType);
      expect(invertedTypes).toContain('fundedBy'); // inverted from 'funding'
      expect(invertedTypes).toContain('partnership'); // remains the same
    });

    it('should maintain organization data integrity during inversion', async () => {
      // Add a funding relationship
      await addRelationship({
        user: testUser1,
        from: org1.id,
        to: org2.id,
        relationships: ['funding'],
      });

      // Query from org2's perspective
      await signInTestUser(testUserEmail2);
      const session2 = await getCurrentTestSession();
      testUser2 = session2?.user;

      const org2Relationships = await getDirectedRelationships({
        user: testUser2,
        from: org2.id,
        pending: null,
      });

      const relationship = org2Relationships.records[0];

      // Verify the inverted relationship has correct organization data
      expect(relationship.sourceOrganization).toBeDefined();
      expect(relationship.targetOrganization).toBeDefined();

      // Source should be org2 (the one making the query)
      expect(relationship.sourceOrganization.id).toBe(org2.id);
      expect(relationship.sourceOrganization.profile.name).toBe('Fundee Organization');

      // Target should be org1 (the funder)
      expect(relationship.targetOrganization.id).toBe(org1.id);
      expect(relationship.targetOrganization.profile.name).toBe('Funder Organization');

      // Relationship type should be inverted
      expect(relationship.relationshipType).toBe('fundedBy');
    });

    it('should handle affiliation relationships without inversion', async () => {
      // Add affiliation relationship (no inverse defined)
      await addRelationship({
        user: testUser1,
        from: org1.id,
        to: org3.id,
        relationships: ['affiliation'],
      });

      // Query from org1's perspective
      const org1Relationships = await getDirectedRelationships({
        user: testUser1,
        from: org1.id,
        pending: null,
      });

      expect(org1Relationships.records).toHaveLength(1);
      expect(org1Relationships.records[0].relationshipType).toBe('affiliation');

      // Query from org3's perspective
      await signInTestUser(testUserEmail2);
      const session2 = await getCurrentTestSession();
      testUser2 = session2?.user;

      const org3Relationships = await getDirectedRelationships({
        user: testUser2,
        from: org3.id,
        pending: null,
      });

      // Should still be 'affiliation' since there's no inverse defined
      expect(org3Relationships.records).toHaveLength(1);
      expect(org3Relationships.records[0].relationshipType).toBe('affiliation');

      // But the source/target should still be properly swapped
      expect(org3Relationships.records[0].sourceOrganizationId).toBe(org3.id);
      expect(org3Relationships.records[0].targetOrganizationId).toBe(org1.id);
    });
  });
});
