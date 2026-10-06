import { renderDecisionOgImage } from '@/server/decisions/decisionOgImage';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

/** The OG card for the canonical decision page (and its vanity URL). */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/_decisionView/opengraph-image',
)({
  server: {
    handlers: {
      GET: ({ params }) =>
        renderDecisionOgImage({ slug: params.slug, locale: params.locale }),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
