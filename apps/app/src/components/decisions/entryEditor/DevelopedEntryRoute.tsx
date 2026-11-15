'use client';

import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalRelationshipType,
} from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import type { ReactNode } from 'react';

import { EntryEditor } from './EntryEditor';

/**
 * Opens a proposal of a develop phase in the entry editor when it is an entry:
 * the target of at least one `developed` relationship. Any other proposal
 * renders `fallback`, the proposal editor.
 */
export function DevelopedEntryRoute({
  instance,
  proposal,
  decisionSlug,
  fallback,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  decisionSlug: string;
  fallback: ReactNode;
}) {
  const [{ items }] = trpc.decision.listProposalRelationships.useSuspenseQuery({
    targetProposalId: proposal.id,
  });

  const origins = items
    .filter(
      (item) => item.relationshipType === ProposalRelationshipType.DEVELOPED,
    )
    .map((item) => item.proposal);

  if (origins.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <EntryEditor
      instance={instance}
      proposal={proposal}
      decisionSlug={decisionSlug}
      origins={origins}
    />
  );
}
