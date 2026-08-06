import type { User } from '@op/supabase/lib';

import { selectProposalLocations } from './listProposalLocations';
import {
  type AllProposalsScopeInput,
  resolveAllProposalsScope,
} from './resolveAllProposalsScope';

/**
 * Every located proposal on the instance, across all phases — the pin source
 * for the results-phase map.
 *
 * The results tab lists proposals via `listAllProposals`, which is
 * phase-agnostic and paginated. Sourcing its pins from the loaded list pages
 * capped the map at one page, and sourcing them from the phase-scoped
 * `listProposalLocations` would have plotted a different set of proposals than
 * the list shows. Sharing `resolveAllProposalsScope` with `listAllProposals`
 * keeps the pins and the list on exactly the same proposals.
 */
export const listAllProposalLocations = async ({
  input,
  user,
}: {
  input: AllProposalsScopeInput;
  user: User | undefined;
}) => {
  const { buildWhereClause } = await resolveAllProposalsScope({ input, user });

  return { proposals: await selectProposalLocations({ buildWhereClause }) };
};
