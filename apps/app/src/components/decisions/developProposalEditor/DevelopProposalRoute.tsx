'use client';

import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalRelationshipType,
} from '@op/api/encoders';
import { type Proposal, resolveReviewSettings } from '@op/common/client';
import { Header2 } from '@op/sense/Header';
import { SplitPane } from '@op/sense/SplitPane';
import type { JSONContent } from '@tiptap/react';
import { notFound } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../../SiteHeader';
import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { compileProposalSchema } from '../forms/proposal';
import { ProposalEditor } from '../proposalEditor';
import { ProposalFormRenderer } from '../proposalEditor/ProposalFormRenderer';
import { getProposalEditorTemplate } from '../proposalEditor/getProposalEditorTemplate';
import { decisionRootHref } from '../proposalHrefs';
import { DevelopOriginColumn } from './DevelopOriginColumn';

/**
 * Opens a proposal developed from origins (the target of at least one
 * `developed` relationship) in the proposal editor, with its origin beside the
 * form. Any other proposal is not found on this route.
 *
 * This is the one access gate. The form is editable only for a caller the
 * server lets develop proposals (an admin or a holder of the Develop
 * Proposals permission), and only while the server reports the proposal
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

  const template = getProposalEditorTemplate({
    proposal,
    instanceTemplate: instance.instanceData.proposalTemplate,
  });

  if (!template) {
    throw new Error('Proposal template not found');
  }

  // Mirrors the server's develop gate, which admits admins too.
  const canDevelop = Boolean(
    instance.access?.admin || instance.access?.developProposals,
  );
  const isEditable = canDevelop && proposal.isEditable === true;

  const backHref = `/decisions/${decisionSlug}/current`;
  // The fixed word stands in until the entry form PR gives the phase's entry
  // form its own name.
  const heading = template.title || t('decisions.developEditor.entryHeading');
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

  const originPane = {
    label: t('decisions.developEditor.proposalTab'),
    content: (
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
    ),
  };

  if (isEditable) {
    return (
      <div className="flex h-screen bg-background">
        <ProposalEditor
          instance={instance}
          backHref={backHref}
          proposal={proposal}
          isEditMode
          develop={{ originPane, heading, description }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DecisionSubpageHeader
        backHref={backHref}
        backLabel={t('Back')}
        accountSlot={<UserAvatarMenu className="hidden sm:block" />}
      />
      <SplitPane className="mx-auto w-full max-w-6xl" defaultMobileTabId="form">
        <SplitPane.Pane
          id="origin"
          label={originPane.label}
          className="sm:pt-8"
        >
          {originPane.content}
        </SplitPane.Pane>
        <SplitPane.Pane id="form" label={heading} className="sm:pt-8">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Header2>{heading}</Header2>
              {description ? (
                <p className="text-base text-foreground">{description}</p>
              ) : null}
              <p className="text-base text-muted-foreground">
                {t('decisions.developEditor.readOnlyNotice')}
              </p>
            </div>
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
          </div>
        </SplitPane.Pane>
      </SplitPane>
    </div>
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
