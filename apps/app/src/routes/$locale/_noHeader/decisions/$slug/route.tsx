import { Outlet, createFileRoute } from '@tanstack/react-router';

import { DecisionLoading } from '@/components/decisions/DecisionLoading';

/**
 * Every screen of one decision. Its no-access screen — which offers a pending
 * invite to the decision — is picked by `RouteError` from this route's id.
 */
export const Route = createFileRoute('/$locale/_noHeader/decisions/$slug')({
  component: Outlet,
  pendingComponent: DecisionLoading,
});
