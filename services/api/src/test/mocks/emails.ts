import { vi } from 'vitest';

export const OPNodemailer = vi.fn().mockResolvedValue(undefined);

export const OPBatchSend = vi
  .fn()
  .mockImplementation((emails: { to: string }[]) =>
    Promise.resolve({
      data: emails.map((e) => ({ id: `mock-${e.to}` })),
      errors: [],
    }),
  );

export const OPInvitationEmail = vi.fn(() => null);
export const OPRelationshipRequestEmail = vi.fn(() => null);
export const CommentNotificationEmail = vi.fn(() => null);
export const ReactionNotificationEmail = vi.fn(() => null);
