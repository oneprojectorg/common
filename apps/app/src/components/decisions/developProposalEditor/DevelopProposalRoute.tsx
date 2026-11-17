'use client';

import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalRelationshipType,
} from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  resolveReviewSettings,
} from '@op/common/client';
import type { JSONContent } from '@tiptap/react';
import { notFound } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

import { compileProposalSchema } from '../forms/proposal';
import { ProposalFormRenderer } from '../proposalEditor/ProposalFormRenderer';
import { decisionRootHref } from '../proposalHrefs';
import { DevelopProposalEditor } from './DevelopProposalEditor';
import { DevelopProposalFrame } from './DevelopProposalFrame';
import { DevelopSourceColumn } from './DevelopSourceColumn';
import { getDevelopEntryHeading } from './getDevelopEntryHeading';

/**
 * Opens a proposal developed from sources beside its source; any other
 * proposal is not found. The form is editable only for a caller who may
 * develop proposals, and only while the server reports the proposal editable.
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
  const t = useTranslations();
  const [{ items }] = trpc.decision.listProposalRelationships.useSuspenseQuery({
    targetProposalId: proposal.id,
    relationshipType: ProposalRelationshipType.DEVELOPED,
  });

  const sources = items.map((item) => item.proposal);

  if (sources.length === 0) {
    notFound();
  }

  const template: ProposalTemplateSchema | undefined =
    instance.instanceData.proposalTemplate;

  if (!template) {
    throw new Error('Proposal template not found');
  }

  // Mirrors the server's develop gate, which admits admins too.
  const canDevelop = Boolean(
    instance.access?.admin || instance.access?.developProposals,
  );
  const isEditable = canDevelop && proposal.isEditable === true;

  const backHref = `/decisions/${decisionSlug}/current`;
  const heading = getDevelopEntryHeading({
    template,
    fallback: t('decisions.developEditor.entryHeading'),
  });
  const description = template.description || undefined;

  const phases = instance.instanceData.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const sourcePhaseId =
    currentIndex > 0 ? (phases[currentIndex - 1]?.phaseId ?? null) : null;

  // Mirrors the server's `canReadPhaseReviews` on the source phase.
  const canReadReviews =
    Boolean(instance.access?.admin) ||
    (Boolean(instance.access?.review) &&
      !!sourcePhaseId &&
      resolveReviewSettings(instance.instanceData ?? {}, sourcePhaseId)
        .openReviews);

  const sourceLabel = t('decisions.developEditor.proposalTab');
  const source = (
    <DevelopSourceColumn
      sources={sources}
      decisionRoot={decisionRootHref({
        decisionSlug,
        slug: decisionSlug,
        instanceId: instance.id,
      })}
      sourcePhaseId={sourcePhaseId}
      canReadReviews={canReadReviews}
    />
  );

  if (isEditable) {
    return (
      <DevelopProposalEditor
        instance={instance}
        proposal={proposal}
        backHref={backHref}
        source={source}
        sourceLabel={sourceLabel}
        heading={heading}
        description={description}
      />
    );
  }

  return (
    <DevelopProposalFrame
      backHref={backHref}
      source={source}
      sourceLabel={sourceLabel}
      heading={heading}
      description={description}
      notice={
        <p className="text-base text-muted-foreground">
          {t('decisions.developEditor.readOnlyNotice')}
        </p>
      }
    >
      <ProposalFormRenderer
        fields={compileProposalSchema(template)}
        draft={{
          title: proposal.profile.name ?? '',
          category: [],
          budget: null,
          location: null,
        }}
        decisionProfileId={instance.profileId ?? null}
        onFieldChange={() => {}}
        mode="preview-version"
        previewVersionFragmentContents={getStoredFragments(proposal)}
      />
    </DevelopProposalFrame>
  );
}

/** The stored document's fragments, keyed by field. */
function getStoredFragments(
  proposal: Proposal,
): Record<string, JSONContent | null> {
  if (proposal.documentContent?.type !== 'json') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(proposal.documentContent.fragments).map(
      ([key, fragment]) => [key, isJsonContent(fragment) ? fragment : null],
    ),
  );
}

function isJsonContent(value: unknown): value is JSONContent {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
