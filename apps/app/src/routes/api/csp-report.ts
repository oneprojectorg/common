import { handleCspReport } from '@/server/api/cspReport';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/csp-report')({
  server: {
    handlers: {
      POST: ({ request }) => handleCspReport(request),
      ANY: methodNotAllowed(['POST']),
    },
  },
});
