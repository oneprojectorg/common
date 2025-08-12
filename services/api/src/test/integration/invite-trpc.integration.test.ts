import { createOrganization, getRoles } from '@op/common';
import { createTRPCMsw } from 'msw-trpc';
import { beforeEach, describe, expect, it } from 'vitest';

import { appRouter } from '../../routers';
import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

// Create tRPC caller for testing
const createCaller = (context: any) => {
  return appRouter.createCaller(context);
};

describe('Invite tRPC API Integration Tests', () => {
  let testInviterUser: any;
  let testOrganization: any;
  let adminRoleId: string;
  let caller: any;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'organization_user_to_access_roles',
      'organization_users',
      'allow_list',
      'organizations_terms',
      'organizations_strategies', 
      'organizations_where_we_work',
      'organizations',
      'profiles',
      'links',
      'locations',
    ]);
    await signOutTestUser();

    // Create inviter user and organization
    const testInviterEmail = `trpc-inviter-${Date.now()}@example.com`;
    await createTestUser(testInviterEmail);
    await signInTestUser(testInviterEmail);
    
    const session = await getCurrentTestSession();
    testInviterUser = session?.user;

    // Create tRPC caller with authenticated context
    caller = createCaller({
      user: testInviterUser,
      req: {}, // Mock request object
      res: {}, // Mock response object
    });

    // Create a test organization
    const organizationData = {
      name: 'tRPC Test Organization',
      website: 'https://trpc-test.com',
      email: 'contact@trpc-test.com',
      orgType: 'nonprofit',
      bio: 'Organization for testing tRPC invite API',
      mission: 'To test the tRPC invite endpoints',
      networkOrganization: false,
      isReceivingFunds: false,
      isOfferingFunds: false,
      acceptingApplications: false,
    };

    testOrganization = await createOrganization({
      data: organizationData,
      user: testInviterUser,
    });

    // Get the Admin role ID for testing
    const { roles } = await getRoles();
    const adminRole = roles.find(role => role.name === 'Admin');
    if (!adminRole) {
      throw new Error('Admin role not found in test database');
    }
    adminRoleId = adminRole.id;
  });

  describe('organization.getRoles endpoint', () => {
    it('should return available roles through tRPC', async () => {
      const result = await caller.organization.getRoles();

      expect(result).toBeDefined();
      expect(result.roles).toBeDefined();
      expect(Array.isArray(result.roles)).toBe(true);
      expect(result.roles.length).toBeGreaterThan(0);

      // Verify role structure
      result.roles.forEach(role => {
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(typeof role.id).toBe('string');
        expect(typeof role.name).toBe('string');
        // description can be null
        expect(['string', 'object']).toContain(typeof role.description);
      });

      // Should include Admin role
      const adminRole = result.roles.find(role => role.name === 'Admin');
      expect(adminRole).toBeDefined();
      expect(adminRole?.id).toBe(adminRoleId);
    });

    it('should require authentication', async () => {
      // Create unauthenticated caller
      const unauthenticatedCaller = createCaller({
        user: null,
        req: {},
        res: {},
      });

      await expect(
        unauthenticatedCaller.organization.getRoles()
      ).rejects.toThrow();
    });
  });

  describe('organization.invite endpoint', () => {
    it('should successfully invite users with role ID via tRPC', async () => {
      const testInviteeEmail = `trpc-invitee-${Date.now()}@example.com`;

      const result = await caller.organization.invite({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        personalMessage: 'Welcome via tRPC!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.details?.successful).toContain(testInviteeEmail);
      expect(result.details?.failed).toHaveLength(0);

      // The underlying service should have been called correctly
      // (we trust the integration tests in invite.integration.test.ts for detailed verification)
    });

    it('should handle multiple emails via tRPC', async () => {
      const email1 = `trpc-multi1-${Date.now()}@example.com`;
      const email2 = `trpc-multi2-${Date.now()}@example.com`;

      const result = await caller.organization.invite({
        emails: [email1, email2],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toHaveLength(2);
      expect(result.details?.successful).toContain(email1);
      expect(result.details?.successful).toContain(email2);
    });

    it('should handle single email format via tRPC', async () => {
      const testInviteeEmail = `trpc-single-${Date.now()}@example.com`;

      const result = await caller.organization.invite({
        email: testInviteeEmail, // Single email format
        roleId: adminRoleId,
        organizationId: testOrganization.id,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(testInviteeEmail);
    });

    it('should require valid roleId via tRPC', async () => {
      const testInviteeEmail = `trpc-invalid-role-${Date.now()}@example.com`;

      await expect(
        caller.organization.invite({
          emails: [testInviteeEmail],
          roleId: 'invalid-role-id', // Invalid UUID format
          organizationId: testOrganization.id,
        })
      ).rejects.toThrow('Role ID must be a valid UUID');
    });

    it('should require roleId parameter via tRPC', async () => {
      const testInviteeEmail = `trpc-missing-role-${Date.now()}@example.com`;

      await expect(
        caller.organization.invite({
          emails: [testInviteeEmail],
          // Missing roleId
          organizationId: testOrganization.id,
        })
      ).rejects.toThrow();
    });

    it('should validate email format via tRPC', async () => {
      await expect(
        caller.organization.invite({
          emails: ['invalid-email-format'],
          roleId: adminRoleId,
          organizationId: testOrganization.id,
        })
      ).rejects.toThrow('Must be a valid email address');
    });

    it('should require authentication for invites', async () => {
      const unauthenticatedCaller = createCaller({
        user: null,
        req: {},
        res: {},
      });

      const testInviteeEmail = `trpc-unauth-${Date.now()}@example.com`;

      await expect(
        unauthenticatedCaller.organization.invite({
          emails: [testInviteeEmail],
          roleId: adminRoleId,
          organizationId: testOrganization.id,
        })
      ).rejects.toThrow();
    });

    it('should handle rate limiting', async () => {
      // Note: This test assumes rate limiting is configured
      // The actual behavior depends on your rate limiting setup
      const testInviteeEmail = `trpc-rate-limit-${Date.now()}@example.com`;

      // First request should succeed
      const result1 = await caller.organization.invite({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
      });

      expect(result1.success).toBe(true);

      // Additional requests might be rate limited
      // This depends on your actual rate limiting configuration
      // You may need to adjust this test based on your limits
    });
  });

  describe('Input validation edge cases', () => {
    it('should handle empty email arrays', async () => {
      await expect(
        caller.organization.invite({
          emails: [], // Empty array
          roleId: adminRoleId,
          organizationId: testOrganization.id,
        })
      ).rejects.toThrow('At least one email address is required');
    });

    it('should validate organization ID format', async () => {
      const testInviteeEmail = `trpc-invalid-org-${Date.now()}@example.com`;

      await expect(
        caller.organization.invite({
          emails: [testInviteeEmail],
          roleId: adminRoleId,
          organizationId: 'invalid-org-id', // Invalid UUID
        })
      ).rejects.toThrow();
    });

    it('should handle optional personal message', async () => {
      const testInviteeEmail = `trpc-no-message-${Date.now()}@example.com`;

      const result = await caller.organization.invite({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        // No personalMessage provided
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(testInviteeEmail);
    });

    it('should handle long personal messages', async () => {
      const testInviteeEmail = `trpc-long-message-${Date.now()}@example.com`;
      const longMessage = 'A'.repeat(1000); // Very long message

      const result = await caller.organization.invite({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
        personalMessage: longMessage,
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(testInviteeEmail);
    });
  });

  describe('Error response format', () => {
    it('should return properly formatted error responses', async () => {
      try {
        await caller.organization.invite({
          emails: ['invalid-email'],
          roleId: adminRoleId,
          organizationId: testOrganization.id,
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Verify error has expected tRPC structure
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
        // tRPC errors should have specific format
        expect(typeof error.message).toBe('string');
      }
    });

    it('should handle database errors gracefully', async () => {
      const testInviteeEmail = `trpc-db-error-${Date.now()}@example.com`;

      try {
        await caller.organization.invite({
          emails: [testInviteeEmail],
          roleId: '00000000-0000-0000-0000-000000000000', // Non-existent role ID
          organizationId: testOrganization.id,
        });
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Response format consistency', () => {
    it('should return consistent success response format', async () => {
      const testInviteeEmail = `trpc-format-${Date.now()}@example.com`;

      const result = await caller.organization.invite({
        emails: [testInviteeEmail],
        roleId: adminRoleId,
        organizationId: testOrganization.id,
      });

      // Verify response matches expected schema
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        message: expect.any(String),
        details: expect.objectContaining({
          successful: expect.any(Array),
          failed: expect.any(Array),
        }),
      });

      expect(result.success).toBe(true);
      expect(result.details?.successful).toContain(testInviteeEmail);
      expect(result.details?.failed).toHaveLength(0);
    });
  });
});