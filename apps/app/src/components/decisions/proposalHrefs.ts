/**
 * Proposal URLs. Five surfaces built this same fork inline — the grid, the map,
 * the results list, the ballot, and the browse card — so a route change meant
 * finding all five.
 */
export interface ProposalRoute {
  /** The proposal's profile id, not its proposal id. */
  profileId: string;
  /** Decision profile slug. Absent on the legacy route. */
  decisionSlug?: string;
  /** Owning profile slug, for the legacy route. */
  slug: string;
  instanceId: string;
}

/** The decision's own route prefix — what `ProposalView` calls `decisionRoot`. */
export function decisionRootHref({
  decisionSlug,
  slug,
  instanceId,
}: Omit<ProposalRoute, 'profileId'>): string {
  return decisionSlug
    ? `/decisions/${decisionSlug}`
    : `/profile/${slug}/decisions/${instanceId}`;
}

export function proposalHref(route: ProposalRoute): string {
  return `${decisionRootHref(route)}/proposal/${route.profileId}`;
}

export function proposalEditHref(route: ProposalRoute): string {
  return `${proposalHref(route)}/edit`;
}

/** A proposal on the decision route, for a screen that only renders there. */
export function decisionProposalHref({
  decisionSlug,
  profileId,
}: {
  decisionSlug: string;
  profileId: string;
}): string {
  return `/decisions/${decisionSlug}/proposal/${profileId}`;
}

/**
 * The develop view of a proposal: the editor of an entry developed from
 * sources, or a source of the current develop phase that has no entry yet.
 */
export function decisionProposalDevelopHref(route: {
  decisionSlug: string;
  profileId: string;
}): string {
  return `${decisionProposalHref(route)}/develop`;
}

export function proposalReviewsHref(route: ProposalRoute): string {
  return `${proposalHref(route)}/reviews`;
}

export function reviewerPageHref({
  decisionSlug,
  reviewerProfileId,
}: {
  decisionSlug: string;
  reviewerProfileId: string;
}): string {
  return `/decisions/${decisionSlug}/assignments/${reviewerProfileId}`;
}
