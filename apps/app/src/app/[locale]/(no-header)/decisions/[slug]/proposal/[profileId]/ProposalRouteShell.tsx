import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { ReactNode } from 'react';

import { loadProposal } from './loadProposal';

/**
 * Server shell shared by the proposal routes.
 *
 * Two jobs, and the order between them is the point: settle access before the
 * client tree mounts (see `loadProposal` for why a client error boundary
 * can't own that), then hand the client the fetch it would otherwise repeat,
 * as a dehydrated cache.
 *
 * Every route under this proposal wants both, so it lives here rather than
 * being re-derived per page — the route that forgets is the one that ships
 * the bug back.
 */
export const ProposalRouteShell = async ({
  slug,
  profileId,
  children,
}: {
  slug: string;
  profileId: string;
  children: ReactNode;
}) => {
  const { queryClient } = await createServerUtils();

  await loadProposal({ slug, profileId });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
};
