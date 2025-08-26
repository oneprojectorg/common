import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProposalFileUpload } from '../../src/hooks/useProposalFileUpload';

// Mock tRPC
const mockMutateAsync = vi.fn();
const mockUseMutation = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
}));

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      uploadProposalAttachment: {
        useMutation: mockUseMutation,
      },
    },
  },
}));

// Mock toast
vi.mock('@op/ui/Toast', () => ({
  toast: {
    status: vi.fn(),
  },
}));

// Mock FileReader
const mockFileReader = {
  readAsDataURL: vi.fn(),
  result: '',
  onload: null as any,
  onerror: null as any,
};

Object.defineProperty(window, 'FileReader', {
  writable: true,
  value: vi.fn(() => mockFileReader),
});

// Mock URL.createObjectURL and URL.revokeObjectURL
Object.defineProperty(window, 'URL', {
  writable: true,
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

describe('useProposalFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileReader.readAsDataURL.mockClear();
  });

  it('should upload files and create attachment records with proper IDs', async () => {
    const { result } = renderHook(() => useProposalFileUpload({}));

    const validFile = new File(['content'], 'test.png', { type: 'image/png' });

    // Mock FileReader success
    mockFileReader.result = 'data:image/png;base64,dGVzdA==';
    mockFileReader.readAsDataURL.mockImplementation(() => {
      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 0);
    });

    // Mock successful upload with attachment ID from attachments table
    mockMutateAsync.mockResolvedValue({
      id: 'attachment-db-record-id', // This is the attachments table ID, not storage ID
      url: 'https://supabase.co/signed-url',
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSize: 1024,
    });

    let uploadResult;
    await act(async () => {
      uploadResult = await result.current.uploadFile(validFile);
    });

    // Verify the result contains the database attachment ID
    expect(uploadResult).toEqual({
      id: 'attachment-db-record-id',
      url: 'https://supabase.co/signed-url',
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSize: 1024,
    });

    // Verify this ID can be used for proposal attachment linking
    expect(result.current.getUploadedAttachmentIds()).toEqual(['attachment-db-record-id']);
  });
});