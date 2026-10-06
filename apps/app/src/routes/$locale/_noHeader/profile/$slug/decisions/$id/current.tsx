import { createFileRoute } from '@tanstack/react-router';

import { redirect } from '@/lib/i18n';

// The legacy decision view has no phase sub-routes — its root page already
// renders the current state. Redirect so shared links built against the new
// `<decisionRoot>/current` shape still resolve here.
export const Route = createFileRoute(
  '/$locale/_noHeader/profile/$slug/decisions/$id/current',
)({
  beforeLoad: ({ params }) => {
    redirect({
      href: `/profile/${params.slug}/decisions/${params.id}`,
      locale: params.locale,
    });
  },
});
