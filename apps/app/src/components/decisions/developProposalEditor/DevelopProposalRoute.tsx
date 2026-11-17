'use client';

import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalRelationshipType,
} from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  getPreviousReviewPhases,
  hasOpenReviews,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import { toast } from '@op/sense/Toast';
import type { JSONContent } from '@tiptap/react';
import type { ComponentProps } from 'react';
import { LuPencil } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DocumentNotAvailable } from '../DocumentNotAvailable';
import { compileProposalSchema } from '../forms/proposal';
import { ProposalFormRenderer } from '../proposalEditor/ProposalFormRenderer';
import { decisionRootHref } from '../proposalHrefs';
import { useLiveProposalDocument } from '../useLiveProposalDocument';
import { DevelopOriginColumn } from './DevelopOriginColumn';
import { DevelopProposalEditor } from './DevelopProposalEditor';
import { DevelopProposalFrame } from './DevelopProposalFrame';
import { getDevelopEntryHeading } from './getDevelopEntryHeading';

type FrameProps = Pick<
  ComponentProps<typeof DevelopProposalFrame>,
  'backHref' | 'origin' | 'originLabel' | 'heading' | 'description'
>;

/**
 * The develop screen of one proposal, the origin: the proposal on one side and
 * the entry developed from it on the other. Without an entry, a caller who
 * may develop proposals can start one. The entry is editable only for such a
 * caller, and only while the server reports it editable.
 */
export function DevelopProposalRoute({
  instance,
  proposal: origin,
  decisionSlug,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  decisionSlug: string;
}) {
  const t = useTranslations();
  const [{ items }] = trpc.decision.listProposalRelationships.useSuspenseQuery({
    sourceProposalId: origin.id,
  });

  // The server lets a proposal be developed more than once. This screen keeps
  // one entry per proposal: it shows the first and offers to start one only
  // when there is none.
  const entry = items.find(
    (item) => item.relationshipType === ProposalRelationshipType.DEVELOPED,
  )?.proposal;

  const template: ProposalTemplateSchema | undefined =
    instance.instanceData.proposalTemplate;

  if (!template) {
    throw new Error('Proposal template not found');
  }

  // Mirrors the server's develop gate, which admits admins too.
  const canDevelop = Boolean(
    instance.access?.admin || instance.access?.developProposals,
  );

  // Every earlier review phase, as the review screens list them. The filter
  // mirrors the server's `canReadPhaseReviews`.
  const isAdmin = Boolean(instance.access?.admin);
  const canReview = Boolean(instance.access?.review);
  const reviewPhases = instance.currentStateId
    ? getPreviousReviewPhases(
        instance.instanceData ?? {},
        instance.currentStateId,
      )
        .filter((phase) => isAdmin || (canReview && hasOpenReviews(phase)))
        .map((phase) => ({
          id: phase.phaseId,
          name: phase.name ?? phase.phaseId,
        }))
    : [];

  const frame: FrameProps = {
    backHref: `/decisions/${decisionSlug}/current`,
    origin: (
      <DevelopOriginColumn
        profileId={origin.profileId}
        decisionRoot={decisionRootHref({
          decisionSlug,
          slug: decisionSlug,
          instanceId: instance.id,
        })}
        reviewPhases={reviewPhases}
      />
    ),
    originLabel: t('decisions.developEditor.proposalTab'),
    heading: getDevelopEntryHeading({
      template,
      fallback: t('decisions.developEditor.entryHeading'),
    }),
    description: template.description || undefined,
  };

  if (!entry) {
    return (
      <DevelopProposalFrame
        {...frame}
        notice={
          <p className="text-base text-muted-foreground">
            {t('decisions.developEditor.noEntry')}
          </p>
        }
      >
        {canDevelop ? (
          <StartEntryButton processInstanceId={instance.id} origin={origin} />
        ) : null}
      </DevelopProposalFrame>
    );
  }

  return (
    <DevelopEntry
      entryProfileId={entry.profile.id}
      instance={instance}
      template={template}
      canDevelop={canDevelop}
      frame={frame}
    />
  );
}

/** The entry: the editor when the caller may edit it, else its stored fields. */
function DevelopEntry({
  entryProfileId,
  instance,
  template,
  canDevelop,
  frame,
}: {
  entryProfileId: string;
  instance: ProcessInstance;
  template: ProposalTemplateSchema;
  canDevelop: boolean;
  frame: FrameProps;
}) {
  const t = useTranslations();
  const [entry] = trpc.decision.getProposal.useSuspenseQuery({
    profileId: entryProfileId,
  });

  if (canDevelop && entry.isEditable === true) {
    return (
      <DevelopProposalEditor instance={instance} proposal={entry} {...frame} />
    );
  }

  return (
    <DevelopProposalFrame
      {...frame}
      notice={
        <p className="text-base text-muted-foreground">
          {t('decisions.developEditor.readOnlyNotice')}
        </p>
      }
    >
      <ReadOnlyFields
        initialProposal={entry}
        template={template}
        decisionProfileId={instance.profileId ?? null}
      />
    </DevelopProposalFrame>
  );
}

/** Creates the draft entry, seeded with the origin's title and category. */
function StartEntryButton({
  processInstanceId,
  origin,
}: {
  processInstanceId: string;
  origin: Proposal;
}) {
  const t = useTranslations('decisions.develop');
  const createEntry = trpc.decision.createDevelopedProposal.useMutation({
    onError: (error) => {
      logger.error('Failed to prepare a develop entry', { error });
      toast.error(t('prepareEntryError'));
    },
  });
  // Busy after success too: the relationships read refreshes through its
  // channel and the editor replaces this button.
  const isBusy = createEntry.isPending || createEntry.isSuccess;

  return (
    <div>
      <Button
        variant="outline"
        disabled={isBusy}
        loading={isBusy}
        onClick={() =>
          createEntry.mutate({
            processInstanceId,
            sourceProposalIds: [origin.id],
            proposalData: {
              title: origin.profile.name,
              category: origin.proposalData.category,
            },
          })
        }
      >
        <LuPencil aria-hidden data-icon="inline-start" />
        {t('prepareEntryAction')}
      </Button>
    </div>
  );
}

/** The stored fields, re-read while the document is still propagating. */
function ReadOnlyFields({
  initialProposal,
  template,
  decisionProfileId,
}: {
  initialProposal: Proposal;
  template: ProposalTemplateSchema;
  decisionProfileId: string | null;
}) {
  const { proposal, documentState } = useLiveProposalDocument(initialProposal);

  if (documentState === 'pending') {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (documentState === 'error') {
    return <DocumentNotAvailable className="py-4" />;
  }

  return (
    <ProposalFormRenderer
      fields={compileProposalSchema(template)}
      draft={{
        title: proposal.profile.name ?? '',
        category: [],
        budget: null,
        location: null,
      }}
      decisionProfileId={decisionProfileId}
      onFieldChange={() => {}}
      mode="preview-version"
      previewVersionFragmentContents={getStoredFragments(proposal)}
    />
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
