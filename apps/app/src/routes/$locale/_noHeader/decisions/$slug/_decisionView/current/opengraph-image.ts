import { renderDecisionOgImage } from '@/server/decisions/decisionOgImage';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { createFileRoute } from '@tanstack/react-router';

/** The current-phase tab shares the decision's OG card. */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/_decisionView/current/opengraph-image',
)({
  server: {
    handlers: {
      GET: ({ params }) =>
        renderDecisionOgImage({ slug: params.slug, locale: params.locale }),
      ANY: methodNotAllowed(['GET']),
    },
  },
});
