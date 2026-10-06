import { handleAuthCallback } from '@/server/api/authCallback';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthCallback(request),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
