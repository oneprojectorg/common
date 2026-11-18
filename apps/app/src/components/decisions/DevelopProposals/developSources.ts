import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import type { DevelopSource, ListDevelopSourcesInput } from '@op/common/client';

import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';

export type DevelopSourceScope = ListDevelopSourcesInput['scope'];

export type DevelopSourcesInput = ReturnType<typeof getDevelopSourcesInput>;

export function getDevelopSourceScope(
  instance: ProcessInstance,
): DevelopSourceScope {
  return instance.access?.admin ? 'all' : 'assigned';
}

/** The sources table's query input; a reader with the same input shares its pages. */
export function getDevelopSourcesInput({
  processInstanceId,
  sourcePhaseId,
  scope,
}: {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
}) {
  return {
    processInstanceId,
    phaseIds: [sourcePhaseId],
    scope,
    limit: PROPOSALS_PAGE_LIMIT,
  };
}

export function isSourceAdvancing(source: DevelopSource): boolean {
  const developedEntry = source.developedProposals[0];
  return !!developedEntry && developedEntry.status !== ProposalStatus.DRAFT;
}
