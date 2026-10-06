import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$')({
  server: {
    handlers: {
      ANY: () => new Response('Not Found', { status: 404 }),
    },
  },
});
