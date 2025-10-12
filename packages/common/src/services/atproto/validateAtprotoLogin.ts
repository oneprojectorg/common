import { TRPCError } from '@trpc/server';

import { getAllowListUser } from '../user';

const allowedEmailDomains = ['anthropic.com'];

export async function validateAtprotoLogin(input: {
  did: string;
  email: string;
}): Promise<boolean> {
  const emailDomain = input.email.split('@')[1];

  if (!emailDomain) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid email format',
    });
  }

  const allowedUser = await getAllowListUser({ email: input.email });

  if (allowedUser) {
    return true;
  }

  if (allowedEmailDomains.includes(emailDomain)) {
    return true;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message:
      'Platform is invite-only. You are on the waitlist. Check back soon!',
  });
}
