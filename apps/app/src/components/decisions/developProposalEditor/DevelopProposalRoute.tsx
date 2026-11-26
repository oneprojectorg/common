'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import {
  type ProcessInstance,
  ProposalRelationshipType,
  ProposalStatus,
} from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  getPreviousReviewPhases,
  hasOpenReviews,
} from '@op/common/client';
import { Spinner } from '@op/sense/Spinner';
import { StatusBadge } from '@op/sense/StatusBadge';
import type { JSONContent } from '@tiptap/react';
import { notFound } from 'next/navigation';
import { type ComponentProps, type ReactNode, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DocumentNotAvailable } from '../DocumentNotAvailable';
import { compileProposalSchema } from '../forms/proposal';
import { getSchemaName } from '../getSchemaName';
import { ProposalFormRenderer } from '../proposalEditor/ProposalFormRenderer';
import { decisionRootHref } from '../proposalHrefs';
import { useLiveProposalDocument } from '../useLiveProposalDocument';
import {
  DevelopCoauthorEditor,
  DevelopProposalEditor,
} from './DevelopProposalEditor';
import { DevelopProposalFrame } from './DevelopProposalFrame';
import { DevelopSourceColumn } from './DevelopSourceColumn';
import { isCurrentDevelopSource } from './isCurrentDevelopSource';

type DevelopSources = ComponentProps<typeof DevelopSourceColumn>['sources'];

/**
 * Opens a proposal developed from sources beside its source. A source of the
 * current develop phase with no entry opens beside the note that it has none
 * yet; any other proposal is not found. The entry's form is editable while the
 * server reports the proposal editable and no develop lock holds it: for a
 * caller who may develop proposals, their own lock; for a co-author who may
 * not, the lock of the entry's owner, and without the Advance action. A draft
 * entry that a developer's lock keeps from advancing shows as not advanced,
 * without its form.
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
    if (!isCurrentDevelopSource({ instance, proposal })) {
      notFound();
    }

    return (
      <DevelopSourceWithoutEntry
        instance={instance}
        proposal={proposal}
        decisionSlug={decisionSlug}
      />
    );
  }

  const template = proposal.proposalTemplate ?? null;

  if (!template) {
    throw new Error('Proposal template not found');
  }

  // Mirrors the server's develop gate, which admits admins too.
  const canDevelop = Boolean(
    instance.access?.admin || instance.access?.developProposals,
  );

  const backHref = getDevelopBackHref(decisionSlug);
  const heading = getSchemaName({
    template,
    fallback: t('decisions.developEditor.entryHeading'),
  });
  const description = template.description || undefined;

  const sourceLabel = t('decisions.developEditor.proposalTab');
  const source = (
    <InstanceSourceColumn
      instance={instance}
      decisionSlug={decisionSlug}
      sources={sources}
    />
  );

  const readOnlyEntry = (
    <DevelopProposalFrame
      backHref={backHref}
      source={source}
      sourceLabel={sourceLabel}
      heading={heading}
      description={description}
      notice={
        // Only a developer can be locked by their own confirm.
        canDevelop ? (
          <APIErrorBoundary fallbacks={{ default: () => <ReadOnlyNotice /> }}>
            <Suspense fallback={<ReadOnlyNotice />}>
              <DevelopLockNotice
                processInstanceId={instance.id}
                isAdvancing={proposal.status !== ProposalStatus.DRAFT}
              />
            </Suspense>
          </APIErrorBoundary>
        ) : (
          <ReadOnlyNotice />
        )
      }
    >
      <ReadOnlyFields
        initialProposal={proposal}
        template={template}
        decisionProfileId={instance.profileId ?? null}
      />
    </DevelopProposalFrame>
  );

  if (!canDevelop) {
    if (proposal.isEditable !== true) {
      return readOnlyEntry;
    }

    return (
      <CoauthorEntryByLockSuspense
        proposal={proposal}
        editor={
          <DevelopCoauthorEditor
            instance={instance}
            proposal={proposal}
            backHref={backHref}
            source={source}
            sourceLabel={sourceLabel}
            heading={heading}
            description={description}
          />
        }
        readOnlyEntry={readOnlyEntry}
      />
    );
  }

  return (
    <DevelopEntryByLock
      processInstanceId={instance.id}
      proposal={proposal}
      editor={
        <DevelopProposalEditor
          instance={instance}
          proposal={proposal}
          backHref={backHref}
          source={source}
          sourceLabel={sourceLabel}
          heading={heading}
          description={description}
        />
      }
      readOnlyEntry={readOnlyEntry}
      notAdvancedEntry={
        <NotAdvancedFrame
          backHref={backHref}
          source={source}
          sourceLabel={sourceLabel}
          heading={heading}
        />
      }
    />
  );
}

/**
 * A developer's entry by their develop lock: the editor while the proposal is
 * editable and they have no lock; a draft as not advanced once the lock means
 * it can no longer advance (they confirmed, or the develop window closed);
 * otherwise the read-only entry.
 */
function DevelopEntryByLock({
  processInstanceId,
  proposal,
  editor,
  readOnlyEntry,
  notAdvancedEntry,
}: {
  processInstanceId: string;
  proposal: Proposal;
  editor: ReactNode;
  readOnlyEntry: ReactNode;
  notAdvancedEntry: ReactNode;
}) {
  const [{ lock }] = trpc.decision.getDevelopConfirmState.useSuspenseQuery({
    processInstanceId,
  });

  if (lock === null && proposal.isEditable === true) {
    return editor;
  }

  if (lock !== null && proposal.status === ProposalStatus.DRAFT) {
    return notAdvancedEntry;
  }

  return readOnlyEntry;
}

/**
 * A co-author's entry by the lock of the entry's owner: the editor while the
 * owner may still develop, otherwise the read-only entry.
 */
function CoauthorEntryByLockSuspense({
  proposal,
  editor,
  readOnlyEntry,
}: {
  proposal: Proposal;
  editor: ReactNode;
  readOnlyEntry: ReactNode;
}) {
  const [{ lock }] = trpc.decision.getDevelopEntryLock.useSuspenseQuery({
    proposalId: proposal.id,
  });

  return lock === null ? editor : readOnlyEntry;
}

/**
 * The develop view of a source whose entry does not advance, as it has none or
 * only a draft that can no longer advance: the source beside the entry's
 * heading, the Not advanced badge, and a note that it gets an entry if it
 * advances. No form.
 */
function NotAdvancedFrame({
  backHref,
  source,
  sourceLabel,
  heading,
}: {
  backHref: string;
  source: ReactNode;
  sourceLabel: string;
  heading: string;
}) {
  const t = useTranslations('decisions');

  return (
    <DevelopProposalFrame
      backHref={backHref}
      source={source}
      sourceLabel={sourceLabel}
      heading={heading}
      notice={
        <StatusBadge variant="inactive" icon={false} className="self-start">
          {t('develop.entryNotAdvancedStatus')}
        </StatusBadge>
      }
    >
      <p className="text-base text-muted-foreground">
        {t('developEditor.noEntryYet')}
      </p>
    </DevelopProposalFrame>
  );
}

/** A source of the current develop phase with no entry yet. */
function DevelopSourceWithoutEntry({
  instance,
  proposal,
  decisionSlug,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');

  return (
    <NotAdvancedFrame
      backHref={getDevelopBackHref(decisionSlug)}
      source={
        <InstanceSourceColumn
          instance={instance}
          decisionSlug={decisionSlug}
          sources={[
            {
              id: proposal.id,
              profile: { id: proposal.profileId, name: proposal.profile.name },
            },
          ]}
        />
      }
      sourceLabel={t('developEditor.proposalTab')}
      heading={t('developEditor.entryHeading')}
    />
  );
}

/**
 * The develop column of sources, with every earlier review phase the caller
 * may read, as the review screens list them.
 */
function InstanceSourceColumn({
  instance,
  decisionSlug,
  sources,
}: {
  instance: ProcessInstance;
  decisionSlug: string;
  sources: DevelopSources;
}) {
  // The filter mirrors the server's `canReadPhaseReviews`.
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

  return (
    <DevelopSourceColumn
      sources={sources}
      decisionRoot={decisionRootHref({
        decisionSlug,
        slug: decisionSlug,
        instanceId: instance.id,
      })}
      reviewPhases={reviewPhases}
    />
  );
}

/**
 * Why a developer sees the entry read-only: once they confirmed their work,
 * the entry's decision and how to change it; otherwise the generic notice.
 */
function DevelopLockNotice({
  processInstanceId,
  isAdvancing,
}: {
  processInstanceId: string;
  isAdvancing: boolean;
}) {
  const t = useTranslations('decisions');
  const [{ lock }] = trpc.decision.getDevelopConfirmState.useSuspenseQuery({
    processInstanceId,
  });

  if (lock !== 'confirmed') {
    return <ReadOnlyNotice />;
  }

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-2">
      <StatusBadge variant={isAdvancing ? 'success' : 'inactive'} icon={false}>
        {isAdvancing
          ? t('develop.entryAdvancingStatus')
          : t('develop.entryNotAdvancedStatus')}
      </StatusBadge>
      <p className="text-base text-muted-foreground">
        {t('developEditor.confirmedNotice')}
      </p>
    </div>
  );
}

function ReadOnlyNotice() {
  const t = useTranslations('decisions');

  return (
    <p aria-live="polite" className="text-base text-muted-foreground">
      {t('developEditor.readOnlyNotice')}
    </p>
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

function getDevelopBackHref(decisionSlug: string): string {
  return `/decisions/${decisionSlug}/current`;
}

function isJsonContent(value: unknown): value is JSONContent {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
