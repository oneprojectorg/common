import { describe } from 'vitest';

describe.skip('uploadProposalAttachment', () => {});

// import { db } from '@op/db/client';
// import { attachments, organizationUsers, profiles, users, organizations } from '@op/db/schema';
// import { createServerClient } from '@op/supabase/lib';
// import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
// import { createTRPCMsw } from 'msw-trpc';
// import { appRouter } from '../../index';
// import type { AppRouter } from '../../index';
// import { createCallerFactory } from '../../trpcFactory';
//
// // Mock Supabase client
// vi.mock('@op/supabase/lib', () => ({
//   createServerClient: vi.fn(() => ({
//     storage: {
//       from: vi.fn(() => ({
//         upload: vi.fn(),
//         createSignedUrl: vi.fn(),
//       })),
//     },
//   })),
// }));
//
// // Mock database
// vi.mock('@op/db/client', () => ({
//   db: {
//     insert: vi.fn(),
//     query: {
//       users: {
//         findFirst: vi.fn(),
//       },
//       profiles: {
//         findFirst: vi.fn(),
//       },
//       organizationUsers: {
//         findFirst: vi.fn(),
//       },
//     },
//   },
// }));
//
// // Mock common utilities
// vi.mock('@op/common', () => ({
//   CommonError: class CommonError extends Error {
//     constructor(message: string) {
//       super(message);
//       this.name = 'CommonError';
//     }
//   },
//   getCurrentProfileId: vi.fn(),
// }));
//
// const createCaller = createCallerFactory(appRouter);
//
// describe('uploadProposalAttachment', () => {
//   const mockUser = {
//     id: 'test-auth-user-id',
//     email: 'test@example.com',
//   };
//
//   const mockProfile = {
//     id: 'test-profile-id',
//     name: 'Test User',
//     entity_type: 'individual' as const,
//   };
//
//   const mockDbUser = {
//     id: 'test-db-user-id',
//     authUserId: 'test-auth-user-id',
//     currentProfileId: 'test-profile-id',
//   };
//
//   const mockOrgUser = {
//     id: 'test-org-user-id',
//     authUserId: 'test-auth-user-id',
//     organizationId: 'test-org-id',
//   };
//
//   const mockSupabaseResponse = {
//     id: 'test-storage-object-id',
//     path: 'profile/test-profile-id/proposals/123456_test.png',
//   };
//
//   const mockSignedUrlResponse = {
//     signedUrl: 'https://supabase.co/storage/signed-url',
//   };
//
//   const mockAttachment = {
//     id: 'test-attachment-id',
//     storageObjectId: 'test-storage-object-id',
//     fileName: 'test.png',
//     mimeType: 'image/png',
//     fileSize: 1024,
//     profileId: 'test-profile-id',
//     postId: null,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };
//
//   beforeEach(() => {
//     vi.clearAllMocks();
//
//     // Mock database responses
//     (db.query.users.findFirst as any).mockResolvedValue(mockDbUser);
//     (db.query.profiles.findFirst as any).mockResolvedValue(mockProfile);
//     (db.query.organizationUsers.findFirst as any).mockResolvedValue(mockOrgUser);
//
//     // Mock database insert
//     (db.insert as any).mockReturnValue({
//       values: vi.fn().mockReturnValue({
//         returning: vi.fn().mockResolvedValue([mockAttachment]),
//       }),
//     });
//
//     // Mock getCurrentProfileId
//     const { getCurrentProfileId } = vi.mocked(await import('@op/common'));
//     getCurrentProfileId.mockResolvedValue('test-profile-id');
//
//     // Mock Supabase storage methods
//     const mockSupabase = vi.mocked(createServerClient());
//     (mockSupabase.storage.from as any).mockReturnValue({
//       upload: vi.fn().mockResolvedValue({
//         data: mockSupabaseResponse,
//         error: null,
//       }),
//       createSignedUrl: vi.fn().mockResolvedValue({
//         data: mockSignedUrlResponse,
//         error: null,
//       }),
//     });
//   });
//
//   afterEach(() => {
//     vi.restoreAllMocks();
//   });
//
//   describe('successful upload', () => {
//     it('should upload image and create attachment record', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       // Create a test image as base64
//       const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0V';
//
//       const result = await caller.decision.uploadProposalAttachment({
//         file: testImageBase64,
//         fileName: 'test.png',
//         mimeType: 'image/png',
//       });
//
//       // Verify Supabase upload was called correctly
//       const mockSupabase = vi.mocked(createServerClient());
//       const mockStorageFrom = mockSupabase.storage.from();
//
//       expect(mockStorageFrom.upload).toHaveBeenCalledWith(
//         expect.stringMatching(/^profile\/test-profile-id\/proposals\/\d+_test\.png$/),
//         expect.any(Buffer),
//         {
//           contentType: 'image/png',
//           upsert: false,
//         }
//       );
//
//       // Verify signed URL creation
//       expect(mockStorageFrom.createSignedUrl).toHaveBeenCalledWith(
//         expect.stringMatching(/^profile\/test-profile-id\/proposals\/\d+_test\.png$/),
//         60 * 60 * 24 // 24 hours
//       );
//
//       // Verify database record creation
//       expect(db.insert).toHaveBeenCalledWith(attachments);
//       expect(db.insert(attachments).values).toHaveBeenCalledWith({
//         storageObjectId: 'test-storage-object-id',
//         fileName: 'test.png',
//         mimeType: 'image/png',
//         fileSize: expect.any(Number),
//         profileId: 'test-profile-id',
//       });
//
//       // Verify response
//       expect(result).toEqual({
//         url: 'https://supabase.co/storage/signed-url',
//         path: expect.stringMatching(/^profile\/test-profile-id\/proposals\/\d+_test\.png$/),
//         id: 'test-attachment-id',
//         fileName: 'test.png',
//         mimeType: 'image/png',
//         fileSize: expect.any(Number),
//       });
//     });
//
//     it('should handle different supported image types', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       const testCases = [
//         { mimeType: 'image/jpeg', fileName: 'test.jpg' },
//         { mimeType: 'image/webp', fileName: 'test.webp' },
//         { mimeType: 'image/gif', fileName: 'test.gif' },
//       ];
//
//       for (const testCase of testCases) {
//         const testFileBase64 = 'data:' + testCase.mimeType + ';base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0V';
//
//         const result = await caller.decision.uploadProposalAttachment({
//           file: testFileBase64,
//           fileName: testCase.fileName,
//           mimeType: testCase.mimeType,
//         });
//
//         expect(result.mimeType).toBe(testCase.mimeType);
//         expect(result.fileName).toBe(testCase.fileName);
//       }
//     });
//
//     it('should handle PDFs', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       const testPdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQ='; // Simple PDF header in base64
//
//       const result = await caller.decision.uploadProposalAttachment({
//         file: testPdfBase64,
//         fileName: 'document.pdf',
//         mimeType: 'application/pdf',
//       });
//
//       expect(result.mimeType).toBe('application/pdf');
//       expect(result.fileName).toBe('document.pdf');
//     });
//   });
//
//   describe('error cases', () => {
//     it('should reject unsupported file types', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       const testFileBase64 = 'data:application/zip;base64,UEsDBBQ=';
//
//       await expect(
//         caller.decision.uploadProposalAttachment({
//           file: testFileBase64,
//           fileName: 'test.zip',
//           mimeType: 'application/zip',
//         })
//       ).rejects.toThrow('Unsupported file type');
//     });
//
//     it('should reject files that are too large', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       // Create a large base64 string (simulate large file)
//       const largeData = 'A'.repeat(10 * 1024 * 1024); // 10MB of 'A's in base64
//       const testFileBase64 = `data:image/png;base64,${largeData}`;
//
//       await expect(
//         caller.decision.uploadProposalAttachment({
//           file: testFileBase64,
//           fileName: 'large.png',
//           mimeType: 'image/png',
//         })
//       ).rejects.toThrow('File too large');
//     });
//
//     it('should handle Supabase upload errors', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       // Mock Supabase to return error
//       const mockSupabase = vi.mocked(createServerClient());
//       (mockSupabase.storage.from as any).mockReturnValue({
//         upload: vi.fn().mockResolvedValue({
//           data: null,
//           error: { message: 'Upload failed' },
//         }),
//         createSignedUrl: vi.fn(),
//       });
//
//       const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0V';
//
//       await expect(
//         caller.decision.uploadProposalAttachment({
//           file: testImageBase64,
//           fileName: 'test.png',
//           mimeType: 'image/png',
//         })
//       ).rejects.toThrow('Upload failed');
//     });
//
//     it('should handle signed URL generation errors', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       // Mock Supabase to return error for signed URL
//       const mockSupabase = vi.mocked(createServerClient());
//       (mockSupabase.storage.from as any).mockReturnValue({
//         upload: vi.fn().mockResolvedValue({
//           data: mockSupabaseResponse,
//           error: null,
//         }),
//         createSignedUrl: vi.fn().mockResolvedValue({
//           data: null,
//           error: { message: 'Could not create signed URL' },
//         }),
//       });
//
//       const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0V';
//
//       await expect(
//         caller.decision.uploadProposalAttachment({
//           file: testImageBase64,
//           fileName: 'test.png',
//           mimeType: 'image/png',
//         })
//       ).rejects.toThrow('Could not get signed url');
//     });
//
//     it('should handle database insertion failure', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       // Mock database to return no attachment
//       (db.insert as any).mockReturnValue({
//         values: vi.fn().mockReturnValue({
//           returning: vi.fn().mockResolvedValue([]), // Empty array means no attachment created
//         }),
//       });
//
//       const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0V';
//
//       await expect(
//         caller.decision.uploadProposalAttachment({
//           file: testImageBase64,
//           fileName: 'test.png',
//           mimeType: 'image/png',
//         })
//       ).rejects.toThrow('Failed to create attachment record');
//     });
//
//     it('should handle invalid base64 data', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       await expect(
//         caller.decision.uploadProposalAttachment({
//           file: 'invalid-base64-data',
//           fileName: 'test.png',
//           mimeType: 'image/png',
//         })
//       ).rejects.toThrow('Invalid base64 encoding');
//     });
//   });
//
//   describe('file sanitization', () => {
//     it('should sanitize filenames with special characters', async () => {
//       const caller = createCaller({
//         user: mockUser,
//         db,
//       });
//
//       const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA0V';
//
//       const result = await caller.decision.uploadProposalAttachment({
//         file: testImageBase64,
//         fileName: 'test file with spaces & special chars!.png',
//         mimeType: 'image/png',
//       });
//
//       // Verify that the filename was sanitized
//       expect(result.fileName).not.toContain(' ');
//       expect(result.fileName).not.toContain('&');
//       expect(result.fileName).not.toContain('!');
//     });
//   });
// });

