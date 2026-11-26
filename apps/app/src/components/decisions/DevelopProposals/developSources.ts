import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import type { DevelopSource, ListDevelopSourcesInput } from '@op/common/client';

import { PROPOSALS_PAGE_LIMIT } from '../proposalFilterQuery';

export type DevelopSourceScope = ListDevelopSourcesInput['scope'];

export type DevelopSourcesInput = ReturnType<typeof getDevelopSourcesInput>;

/** An admin sees every source; anyone else sees the sources assigned to them. */
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
  categoryId,
}: {
  processInstanceId: string;
  sourcePhaseId: string;
  scope: DevelopSourceScope;
  /** Keeps the sources of one category. Omit for every source in scope. */
  categoryId?: string;
}) {
  return {
    processInstanceId,
    phaseIds: [sourcePhaseId],
    scope,
    categoryIds: categoryId ? [categoryId] : undefined,
    limit: PROPOSALS_PAGE_LIMIT,
  };
}

/** A source advances when its first entry is no longer a draft. */
export function isSourceAdvancing(source: DevelopSource): boolean {
  const developedEntry = source.developedProposals[0];
  return !!developedEntry && developedEntry.status !== ProposalStatus.DRAFT;
}
