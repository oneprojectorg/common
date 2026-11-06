import { z } from 'zod';

/**
 * How to reach the account: its login email, else its phone in E.164.
 * Never `profiles.email`, the unverified public field; null means an
 * anonymous account.
 */
export const accountContactSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), email: z.string() }),
  /** `phone` is E.164 with the leading `+`. */
  z.object({ type: z.literal('phone'), phone: z.string() }),
]);

export type AccountContact = z.infer<typeof accountContactSchema>;

/**
 * Maps raw `auth.users` columns (phone stored without `+`) to a contact. A
 * profile with no owning account passes nothing.
 */
export function toAccountContact(
  authUser: { email: string | null; phone: string | null } | null | undefined,
): AccountContact | null {
  if (authUser?.email) {
    return { type: 'email', email: authUser.email };
  }

  if (authUser?.phone) {
    return { type: 'phone', phone: `+${authUser.phone}` };
  }

  return null;
}
