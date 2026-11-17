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
import { DevelopOriginColumn } from './DevelopOriginColumn';
import { DevelopProposalEditor } from './DevelopProposalEditor';
import { DevelopProposalFrame } from './DevelopProposalFrame';
import { getDevelopEntryHeading } from './getDevelopEntryHeading';

/**
 * Opens a proposal developed from origins beside its origin; any other
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
  });

  const origins = items
    .filter(
      (item) => item.relationshipType === ProposalRelationshipType.DEVELOPED,
    )
    .map((item) => item.proposal);

  if (origins.length === 0) {
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
  const originPhaseId =
    currentIndex > 0 ? (phases[currentIndex - 1]?.phaseId ?? null) : null;

  // Mirrors the server's `canReadPhaseReviews` on the origin phase.
  const canReadReviews =
    Boolean(instance.access?.admin) ||
    (Boolean(instance.access?.review) &&
      !!originPhaseId &&
      resolveReviewSettings(instance.instanceData ?? {}, originPhaseId)
        .openReviews);

  const originLabel = t('decisions.developEditor.proposalTab');
  const origin = (
    <DevelopOriginColumn
      origins={origins}
      decisionRoot={decisionRootHref({
        decisionSlug,
        slug: decisionSlug,
        instanceId: instance.id,
      })}
      originPhaseId={originPhaseId}
      canReadReviews={canReadReviews}
    />
  );

  if (isEditable) {
    return (
      <DevelopProposalEditor
        instance={instance}
        proposal={proposal}
        backHref={backHref}
        origin={origin}
        originLabel={originLabel}
        heading={heading}
        description={description}
      />
    );
  }

  return (
    <DevelopProposalFrame
      backHref={backHref}
      origin={origin}
      originLabel={originLabel}
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
