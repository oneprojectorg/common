'use client';

import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalRelationshipType,
} from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { notFound } from 'next/navigation';

import { DevelopProposalEditor } from './DevelopProposalEditor';

/**
 * Opens an entry, the target of at least one `developed` relationship, in the
 * develop editor. Any other proposal is not found on this route.
 *
 * This is the editor's one access gate. The form is editable only for a
 * caller the server lets develop proposals (an admin or a holder of the
 * Develop Proposals permission), and only while the server reports the entry
 * editable. Anyone else gets the read-only view.
 */
export function DevelopProposalRoute({
  instance,
  proposal,
  decisionSlug,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  decisionSlug: string;
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
    notFound();
  }

  // Mirrors the server's develop gate, which admits admins too.
  const canDevelop = Boolean(
    instance.access?.admin || instance.access?.developProposals,
  );

  return (
    <DevelopProposalEditor
      instance={instance}
      proposal={proposal}
      decisionSlug={decisionSlug}
      origins={origins}
      isEditable={canDevelop && proposal.isEditable === true}
    />
  );
}
