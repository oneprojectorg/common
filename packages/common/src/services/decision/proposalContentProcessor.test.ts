import { db } from '@op/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getProposalAttachmentUrls,
  processProposalContent,
} from './proposalContentProcessor';

// Mock database
vi.mock('@op/db/client', () => ({
  db: {
    query: {
      proposals: {
        findFirst: vi.fn(),
      },
      proposalAttachments: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn(),
  },
  eq: vi.fn(),
}));

// Mock schema imports
vi.mock('@op/db/schema', () => ({
  attachments: 'mocked-attachments-table',
  proposalAttachments: 'mocked-proposal-attachments-table',
  proposals: 'mocked-proposals-table',
}));

describe('proposalContentProcessor with public URLs', () => {
  const mockProposal = {
    id: 'test-proposal-id',
    proposalData: {
      content:
        '<p>Test content with <img src="https://temp.supabase.co/storage/v1/object/sign/assets/profile/test-storage-id?token=abc123" alt="test" /></p>',
    },
  };

  const mockAttachment = {
    id: 'test-attachment-id',
    storageObjectId: 'test-storage-id',
    fileName: 'test-image.png',
    mimeType: 'image/png',
    fileSize: 1024,
  };

  const mockProposalAttachmentJoins = [
    {
      id: 'join-id-1',
      proposalId: 'test-proposal-id',
      attachmentId: 'test-attachment-id',
      uploadedBy: 'test-profile-id',
      attachment: mockAttachment,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database queries
    (db.query.proposals.findFirst as any).mockResolvedValue(mockProposal);
    (db.query.proposalAttachments.findMany as any).mockResolvedValue(
      mockProposalAttachmentJoins,
    );

    // Mock database update
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe('processProposalContent', () => {
    it('should replace temporary URLs with permanent public URLs', async () => {
      await processProposalContent({
        conn: db,
        proposalId: 'test-proposal-id',
      });

      // Verify proposal content was updated
      expect(db.update).toHaveBeenCalled();

      const updateCall = (db.update as any).mock.calls[0];
      const setCall = updateCall.return.set.mock.calls[0];
      const updateData = setCall[0];

      // Verify the content was updated with public URL
      expect(updateData.proposalData.content).toContain(
        '/assets/profile/test-storage-id',
      );
      expect(updateData.proposalData.content).not.toContain('temp.supabase.co');
      expect(updateData.proposalData.content).not.toContain('token=abc123');
    });

    it('should handle multiple images in content', async () => {
      const contentWithMultipleImages = `
        <p>First image: <img src="https://temp.supabase.co/storage/v1/object/sign/assets/profile/image1?token=abc123" alt="first" /></p>
        <p>Second image: <img src="https://temp.supabase.co/storage/v1/object/sign/assets/profile/image2?token=def456" alt="second" /></p>
      `;

      const mockProposalMultiImages = {
        ...mockProposal,
        proposalData: {
          content: contentWithMultipleImages,
        },
      };

      const mockAttachments = [
        {
          ...mockProposalAttachmentJoins[0],
          attachment: { ...mockAttachment, storageObjectId: 'image1' },
        },
        {
          ...mockProposalAttachmentJoins[0],
          attachment: { ...mockAttachment, storageObjectId: 'image2' },
        },
      ];

      (db.query.proposals.findFirst as any).mockResolvedValue(
        mockProposalMultiImages,
      );
      (db.query.proposalAttachments.findMany as any).mockResolvedValue(
        mockAttachments,
      );

      await processProposalContent({
        conn: db,
        proposalId: 'test-proposal-id',
      });

      expect(db.update).toHaveBeenCalled();

      const updateCall = (db.update as any).mock.calls[0];
      const setCall = updateCall.return.set.mock.calls[0];
      const updateData = setCall[0];

      // Verify both images were replaced with public URLs
      expect(updateData.proposalData.content).toContain(
        '/assets/profile/image1',
      );
      expect(updateData.proposalData.content).toContain(
        '/assets/profile/image2',
      );
      expect(updateData.proposalData.content).not.toContain('temp.supabase.co');
    });

    it('should handle proposals without images', async () => {
      const mockProposalNoImages = {
        ...mockProposal,
        proposalData: {
          content: '<p>Just text content with no images</p>',
        },
      };

      (db.query.proposals.findFirst as any).mockResolvedValue(
        mockProposalNoImages,
      );

      await processProposalContent({
        conn: db,
        proposalId: 'test-proposal-id',
      });

      // Should return early and not attempt any updates
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should handle proposals without attachments', async () => {
      (db.query.proposalAttachments.findMany as any).mockResolvedValue([]);

      await processProposalContent({
        conn: db,
        proposalId: 'test-proposal-id',
      });

      // Should return early and not attempt any updates
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should not fail when proposal is not found', async () => {
      (db.query.proposals.findFirst as any).mockResolvedValue(null);

      // Should not throw
      await expect(
        processProposalContent({
          conn: db,
          proposalId: 'nonexistent-proposal-id',
        }),
      ).resolves.toBeUndefined();

      expect(db.update).not.toHaveBeenCalled();
    });

    it('should handle missing attachment data gracefully', async () => {
      const mockAttachmentsWithNull = [
        {
          ...mockProposalAttachmentJoins[0],
          attachment: null, // Missing attachment
        },
      ];

      (db.query.proposalAttachments.findMany as any).mockResolvedValue(
        mockAttachmentsWithNull,
      );

      await processProposalContent({
        conn: db,
        proposalId: 'test-proposal-id',
      });

      // Should not crash and should not update content
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('getProposalAttachmentUrls', () => {
    it('should return public URLs for all attachments', async () => {
      const urlMap = await getProposalAttachmentUrls('test-proposal-id');

      expect(urlMap).toEqual({
        'test-attachment-id': '/assets/profile/test-storage-id',
      });
    });

    it('should return empty object when no attachments exist', async () => {
      (db.query.proposalAttachments.findMany as any).mockResolvedValue([]);

      const urlMap = await getProposalAttachmentUrls('test-proposal-id');

      expect(urlMap).toEqual({});
    });

    it('should handle multiple attachments', async () => {
      const mockMultipleAttachments = [
        {
          ...mockProposalAttachmentJoins[0],
          attachment: {
            ...mockAttachment,
            id: 'attachment-1',
            storageObjectId: 'storage-1',
          },
        },
        {
          ...mockProposalAttachmentJoins[0],
          attachment: {
            ...mockAttachment,
            id: 'attachment-2',
            storageObjectId: 'storage-2',
          },
        },
      ];

      (db.query.proposalAttachments.findMany as any).mockResolvedValue(
        mockMultipleAttachments,
      );

      const urlMap = await getProposalAttachmentUrls('test-proposal-id');

      expect(urlMap).toEqual({
        'attachment-1': '/assets/profile/storage-1',
        'attachment-2': '/assets/profile/storage-2',
      });
    });

    it('should skip attachments with missing data', async () => {
      const mockAttachmentsWithMissing = [
        {
          ...mockProposalAttachmentJoins[0],
          attachment: mockAttachment,
        },
        {
          ...mockProposalAttachmentJoins[0],
          attachment: null, // Missing attachment
        },
      ];

      (db.query.proposalAttachments.findMany as any).mockResolvedValue(
        mockAttachmentsWithMissing,
      );

      const urlMap = await getProposalAttachmentUrls('test-proposal-id');

      // Should only include the valid attachment
      expect(urlMap).toEqual({
        'test-attachment-id': '/assets/profile/test-storage-id',
      });
    });
  });

  describe('public URL generation', () => {
    it('should generate consistent URLs that use Next.js rewrites', async () => {
      const urlMap = await getProposalAttachmentUrls('test-proposal-id');
      const publicUrl = urlMap['test-attachment-id'];

      // Verify URL format matches Next.js rewrite expectation
      expect(publicUrl).toBe('/assets/profile/test-storage-id');

      // Verify it's a relative URL (not absolute with domain)
      expect(publicUrl).not.toMatch(/^https?:\/\//);

      // Verify it uses the assets path that Next.js will rewrite
      expect(publicUrl).toMatch(/^\/assets\//);
    });

    it('should work with different storage paths', async () => {
      const testCases = [
        'profile/user123/proposals/image.png',
        'profile/org456/proposals/document.pdf',
        'different/path/structure/file.jpg',
      ];

      for (const storagePath of testCases) {
        const mockAttachmentWithPath = {
          ...mockProposalAttachmentJoins[0],
          attachment: { ...mockAttachment, storageObjectId: storagePath },
        };

        (db.query.proposalAttachments.findMany as any).mockResolvedValue([
          mockAttachmentWithPath,
        ]);

        const urlMap = await getProposalAttachmentUrls('test-proposal-id');
        const publicUrl = urlMap['test-attachment-id'];

        expect(publicUrl).toBe(`/assets/profile/${storagePath}`);
      }
    });
  });
});
