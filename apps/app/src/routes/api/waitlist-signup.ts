import { signUpForWaitlist } from '@/server/api/waitlistSignup';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/waitlist-signup')({
  server: {
    handlers: {
      POST: ({ request }) => signUpForWaitlist(request),
      ANY: methodNotAllowed(['POST']),
    },
  },
});
