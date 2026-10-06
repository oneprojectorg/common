import { methodNotAllowed } from '@/server/methodNotAllowed';
import { redirectResponse } from '@/server/redirectResponse';
import { OPURLConfig } from '@op/core';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth/confirm')({
  server: {
    handlers: {
      GET: () => redirectResponse(OPURLConfig('APP').ENV_URL),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
