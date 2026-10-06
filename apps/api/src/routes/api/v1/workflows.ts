import { getHandler } from '@op/workflows';
import { createFileRoute } from '@tanstack/react-router';

import { methodNotAllowed } from '../../../server/methodNotAllowed';

// Mounts the handler for our @op/workflows package to handle event-driven workflows and tasks
const handler = getHandler();

export const Route = createFileRoute('/api/v1/workflows')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
      ANY: methodNotAllowed(['GET', 'POST', 'PUT']),
    },
  },
});
