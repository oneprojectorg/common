import { forwardTraces } from '@/server/api/otelTraces';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/otel/traces')({
  server: {
    handlers: {
      POST: ({ request }) => forwardTraces(request),
      ANY: methodNotAllowed(['POST']),
    },
  },
});
