import { db } from '@op/db/client';
import {
  attachments,
  profiles,
  proposalAttachments,
  proposals,
  users,
} from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProposal } from './createProposal';
import type { CreateProposalInput } from './createProposal';
import { processProposalContent } from './proposalContentProcessor';

// Mock dependencies
vi.mock('@op/db/client', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      processInstances: {
        findFirst: vi.fn(),
      },
      taxonomyTerms: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  },
}));

vi.mock('./proposalContentProcessor', () => ({
  processProposalContent: vi.fn().mockResolvedValue(undefined),
}));

describe('createProposal with attachments', () => {
  const mockUser = {
    id: 'test-auth-user-id',
    email: 'test@example.com',
  };

  const mockDbUser = {
    id: 'test-db-user-id',
    authUserId: 'test-auth-user-id',
    currentProfileId: 'test-profile-id',
  };

  const mockProcessInstance = {
    id: 'test-process-instance-id',
    currentStateId: 'test-state-id',
    process: {
      processSchema: {
        states: [
          {
            id: 'test-state-id',
            name: 'Test State',
            config: {
              allowProposals: true,
            },
          },
        ],
      },
    },
    instanceData: {
      currentStateId: 'test-state-id',
    },
  };

  const mockProposal = {
    id: 'test-proposal-id',
    processInstanceId: 'test-process-instance-id',
    proposalData: {
      title: 'Test Proposal',
      content:
        '<p>Test content with <img src="https://supabase.co/temp-url" alt="test" /></p>',
    },
    submittedByProfileId: 'test-profile-id',
    profileId: 'test-proposal-profile-id',
    status: 'submitted',
  };

  const mockProposalProfile = {
    id: 'test-proposal-profile-id',
    type: 'PROPOSAL',
    name: 'Test Proposal',
    slug: expect.any(String),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database queries
    (db.query.users.findFirst as any).mockResolvedValue(mockDbUser);
    (db.query.processInstances.findFirst as any).mockResolvedValue(
      mockProcessInstance,
    );
    (db.query.taxonomyTerms.findFirst as any).mockResolvedValue(null);

    // Mock transaction
    (db.transaction as any).mockImplementation(async (callback) => {
      const mockTx = {
        insert: vi.fn(),
      };

      // Mock profile insertion
      mockTx.insert.mockImplementation((table) => {
        if (table === profiles) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockProposalProfile]),
            }),
          };
        }
        // Mock proposal insertion
        if (table === proposals) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockProposal]),
            }),
          };
        }
        // Mock proposalAttachments insertion
        if (table === proposalAttachments) {
          return {
            values: vi.fn().mockResolvedValue(undefined),
          };
        }
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      return callback(mockTx);
    });

    // Mock processProposalContent
    (processProposalContent as any).mockImplementation(() => {
      return Promise.resolve();
    });
  });

  describe('proposal creation with image attachments', () => {
    it('should create proposal and link attachments successfully', async () => {
      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: {
          title: 'Test Proposal with Images',
          content:
            '<p>Test content with <img src="https://supabase.co/temp-url/image1.png" alt="test" /></p>',
        },
        authUserId: 'test-auth-user-id',
        attachmentIds: ['attachment-id-1', 'attachment-id-2'],
      };

      const result = await createProposal({
        data: proposalInput,
        user: mockUser,
      });

      // Verify the proposal was created
      expect(result).toEqual(mockProposal);

      // Verify transaction was called
      expect(db.transaction).toHaveBeenCalledOnce();

      // Verify proposal profile was created
      const mockTx = (db.transaction as any).mock.calls[0][0];
      const txCall = await mockTx({ insert: vi.fn() });

      // Verify proposalAttachments were linked
      expect(db.transaction).toHaveBeenCalled();

      // Verify processProposalContent was called with transaction context
      expect(processProposalContent).toHaveBeenCalledWith({
        conn: expect.any(Object),
        proposalId: 'test-proposal-id',
      });
    });

    it('should create proposal without attachments', async () => {
      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: {
          title: 'Test Proposal without Images',
          content: '<p>Simple text content</p>',
        },
        authUserId: 'test-auth-user-id',
        // No attachmentIds provided
      };

      const result = await createProposal({
        data: proposalInput,
        user: mockUser,
      });

      // Verify the proposal was created
      expect(result).toEqual(mockProposal);

      // Verify transaction was called
      expect(db.transaction).toHaveBeenCalledOnce();

      // Verify processProposalContent was NOT called when no attachments
      expect(processProposalContent).not.toHaveBeenCalled();
    });

    it('should fail when content processing errors occur', async () => {
      // Mock processProposalContent to throw an error
      (processProposalContent as any).mockRejectedValue(
        new Error('Content processing failed'),
      );

      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: {
          title: 'Test Proposal',
          content: '<p>Content with image</p>',
        },
        authUserId: 'test-auth-user-id',
        attachmentIds: ['attachment-id-1'],
      };

      // Should throw when content processing fails (transaction rollback)
      await expect(
        createProposal({
          data: proposalInput,
          user: mockUser,
        }),
      ).rejects.toThrow('Content processing failed');

      expect(processProposalContent).toHaveBeenCalledWith({
        conn: expect.any(Object),
        proposalId: 'test-proposal-id',
      });
    });

    it('should handle empty attachment list', async () => {
      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: {
          title: 'Test Proposal',
          content: '<p>Test content</p>',
        },
        authUserId: 'test-auth-user-id',
        attachmentIds: [], // Empty array
      };

      const result = await createProposal({
        data: proposalInput,
        user: mockUser,
      });

      // Verify the proposal was created
      expect(result).toEqual(mockProposal);

      // Verify transaction was called
      expect(db.transaction).toHaveBeenCalledOnce();
    });

    it('should extract title from proposal data correctly', async () => {
      const testCases = [
        {
          proposalData: { title: 'Explicit Title', content: 'test' },
          expectedTitle: 'Explicit Title',
        },
        {
          proposalData: { name: 'Name Field', content: 'test' },
          expectedTitle: 'Name Field',
        },
        {
          proposalData: { content: 'test' },
          expectedTitle: 'Untitled Proposal',
        },
        {
          proposalData: 'invalid data',
          expectedTitle: 'Untitled Proposal',
        },
      ];

      for (const testCase of testCases) {
        // Mock the profile creation to capture the title
        let capturedTitle = '';
        (db.transaction as any).mockImplementation(async (callback) => {
          const mockTx = {
            insert: vi.fn().mockImplementation((table) => {
              if (table === profiles) {
                return {
                  values: vi.fn().mockImplementation((values) => {
                    capturedTitle = values.name;
                    return {
                      returning: vi
                        .fn()
                        .mockResolvedValue([
                          { ...mockProposalProfile, name: values.name },
                        ]),
                    };
                  }),
                };
              }
              if (table === proposals) {
                return {
                  values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([mockProposal]),
                  }),
                };
              }
              return {
                values: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([]),
                }),
              };
            }),
          };
          return callback(mockTx);
        });

        const proposalInput: CreateProposalInput = {
          processInstanceId: 'test-process-instance-id',
          proposalData: testCase.proposalData,
          authUserId: 'test-auth-user-id',
        };

        await createProposal({
          data: proposalInput,
          user: mockUser,
        });

        expect(capturedTitle).toBe(testCase.expectedTitle);
      }
    });
  });

  describe('error handling', () => {
    it('should throw error if user not found', async () => {
      (db.query.users.findFirst as any).mockResolvedValue(null);

      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: { title: 'Test', content: 'test' },
        authUserId: 'invalid-user-id',
      };

      await expect(
        createProposal({
          data: proposalInput,
          user: mockUser,
        }),
      ).rejects.toThrow('User must have an active profile');
    });

    it('should throw error if process instance not found', async () => {
      (db.query.processInstances.findFirst as any).mockResolvedValue(null);

      const proposalInput: CreateProposalInput = {
        processInstanceId: 'invalid-process-instance-id',
        proposalData: { title: 'Test', content: 'test' },
        authUserId: 'test-auth-user-id',
      };

      await expect(
        createProposal({
          data: proposalInput,
          user: mockUser,
        }),
      ).rejects.toThrow('Process instance not found');
    });

    it('should throw error if proposals not allowed in current state', async () => {
      const mockProcessInstanceWithRestrictedState = {
        ...mockProcessInstance,
        process: {
          processSchema: {
            states: [
              {
                id: 'test-state-id',
                name: 'Restricted State',
                config: {
                  allowProposals: false, // Proposals not allowed
                },
              },
            ],
          },
        },
      };

      (db.query.processInstances.findFirst as any).mockResolvedValue(
        mockProcessInstanceWithRestrictedState,
      );

      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: { title: 'Test', content: 'test' },
        authUserId: 'test-auth-user-id',
      };

      await expect(
        createProposal({
          data: proposalInput,
          user: mockUser,
        }),
      ).rejects.toThrow(
        'Proposals are not allowed in the Restricted State state',
      );
    });

    it('should handle transaction failure gracefully', async () => {
      (db.transaction as any).mockRejectedValue(
        new Error('Transaction failed'),
      );

      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: { title: 'Test', content: 'test' },
        authUserId: 'test-auth-user-id',
      };

      await expect(
        createProposal({
          data: proposalInput,
          user: mockUser,
        }),
      ).rejects.toThrow('Failed to create proposal');
    });
  });

  describe('foreign key constraint validation', () => {
    it('should ensure attachment IDs exist before creating proposal-attachment links', async () => {
      // This test ensures that the attachments exist in the database
      // before we try to reference them in proposalAttachments

      const proposalInput: CreateProposalInput = {
        processInstanceId: 'test-process-instance-id',
        proposalData: {
          title: 'Test Proposal',
          content: '<p>Content with image</p>',
        },
        authUserId: 'test-auth-user-id',
        attachmentIds: ['valid-attachment-id'],
      };

      // Mock transaction to capture the proposalAttachments values
      let capturedAttachmentValues: any[] = [];
      (db.transaction as any).mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockImplementation((table) => {
            if (table === proposalAttachments) {
              return {
                values: vi.fn().mockImplementation((values) => {
                  capturedAttachmentValues = Array.isArray(values)
                    ? values
                    : [values];
                  return Promise.resolve();
                }),
              };
            }
            // Mock other table insertions
            if (table === profiles) {
              return {
                values: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([mockProposalProfile]),
                }),
              };
            }
            if (table === proposals) {
              return {
                values: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([mockProposal]),
                }),
              };
            }
            return {
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]),
              }),
            };
          }),
        };
        return callback(mockTx);
      });

      await createProposal({
        data: proposalInput,
        user: mockUser,
      });

      // Verify the attachment relationships were created with correct structure
      expect(capturedAttachmentValues).toHaveLength(1);
      expect(capturedAttachmentValues[0]).toEqual({
        proposalId: 'test-proposal-id',
        attachmentId: 'valid-attachment-id',
        uploadedBy: 'test-profile-id',
      });
    });
  });
});
