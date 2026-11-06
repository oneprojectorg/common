/**
 * Proposal URLs. Five surfaces built this same fork inline — the grid, the map,
 * the results list, the ballot, and the browse card — so a route change meant
 * finding all five.
 */
export type ProposalRouteBase = { instanceId: string } & (
  | {
      /** Decision profile slug. Absent on the legacy route. */
      decisionSlug: string;
      /** Owning profile slug, for the legacy route. */
      slug?: string;
    }
  | {
      decisionSlug?: undefined;
      /** Owning profile slug, for the legacy route. */
      slug: string;
    }
);

export type ProposalRoute = ProposalRouteBase & {
  /** The proposal's profile id, not its proposal id. */
  profileId: string;
};

/** The decision's own route prefix — what `ProposalView` calls `decisionRoot`. */
export function decisionRootHref(route: ProposalRouteBase): string {
  if (typeof route.decisionSlug === 'string') {
    return `/decisions/${route.decisionSlug}`;
  }
  return `/profile/${route.slug}/decisions/${route.instanceId}`;
}

export function proposalHref(route: ProposalRoute): string {
  return `${decisionRootHref(route)}/proposal/${route.profileId}`;
}

export function proposalEditHref(route: ProposalRoute): string {
  return `${proposalHref(route)}/edit`;
}

export function proposalReviewsHref(route: ProposalRoute): string {
  return `${proposalHref(route)}/reviews`;
}
