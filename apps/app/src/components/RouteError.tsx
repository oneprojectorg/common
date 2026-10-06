import { type ErrorComponentProps, useMatches } from '@tanstack/react-router';

import { isForbiddenError } from '@/lib/forbidden';

import { DecisionForbidden } from '@/components/decisions/DecisionForbidden';
import GlobalError from '@/components/screens/GlobalError';
import { LocaleForbidden } from '@/components/screens/LocaleForbidden';
import PageError from '@/components/screens/PageError';

/**
 * The error screen for every route. `forbidden()` gets the no-access screen —
 * on a decision, the one that offers a pending invite — and anything else the
 * error page, or the bare last-resort screen outside the localized routes.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const routeIds = useMatches({
    select: (matches) => matches.map((match) => match.routeId),
  });
  const isLocalized = routeIds.some((id) => id.startsWith('/$locale'));

  if (isForbiddenError(error)) {
    return routeIds.includes('/$locale/_noHeader/decisions/$slug') ? (
      <DecisionForbidden />
    ) : (
      <LocaleForbidden />
    );
  }

  const normalized = error instanceof Error ? error : new Error(String(error));

  if (!isLocalized) {
    return <GlobalError error={normalized} reset={reset} />;
  }

  return <PageError error={normalized} />;
}
