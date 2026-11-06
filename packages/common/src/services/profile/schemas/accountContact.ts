import type { AuthUser } from '@op/db/schema';
import { z } from 'zod';

/** Login email, else phone in E.164; never `profiles.email`, the unverified public field. */
export const accountContactSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), email: z.string() }),
  z.object({ type: z.literal('phone'), phone: z.string() }),
]);

export type AccountContact = z.infer<typeof accountContactSchema>;

/** `auth.users` stores the phone without `+`; null is an anonymous account. */
export function toAccountContact(
  authUser: Pick<AuthUser, 'email' | 'phone'> | null | undefined,
): AccountContact | null {
  if (authUser?.email) {
    return { type: 'email', email: authUser.email };
  }

  if (authUser?.phone) {
    return { type: 'phone', phone: `+${authUser.phone}` };
  }

  return null;
}
