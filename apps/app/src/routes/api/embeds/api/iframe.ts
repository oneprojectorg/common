import { getEmbedIframe } from '@/server/api/proxyIframelyCdn';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/embeds/api/iframe')({
  server: {
    handlers: {
      GET: ({ request }) => getEmbedIframe(request),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
