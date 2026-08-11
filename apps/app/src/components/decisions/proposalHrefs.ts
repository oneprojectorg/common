/**
 * Proposal URLs. Five surfaces built this same fork inline — the grid, the map,
 * the results list, the ballot, and the browse card — so a route change meant
 * finding all five.
 */
export interface ProposalRouteContext {
  /** Decision profile slug. Absent on the legacy route. */
  decisionSlug?: string;
  /** Owning profile slug, for the legacy route. */
  slug: string;
  instanceId: string;
}

export function proposalHref(
  profileId: string,
  { decisionSlug, slug, instanceId }: ProposalRouteContext,
): string {
  return decisionSlug
    ? `/decisions/${decisionSlug}/proposal/${profileId}`
    : `/profile/${slug}/decisions/${instanceId}/proposal/${profileId}`;
}

export function proposalEditHref(
  profileId: string,
  context: ProposalRouteContext,
): string {
  return `${proposalHref(profileId, context)}/edit`;
}
