import { getEmbedJs } from '@/server/api/proxyIframelyCdn';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/embeds/embed.js')({
  server: {
    handlers: {
      GET: ({ request }) => getEmbedJs(request),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
