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
import { type ComponentProps, type ReactNode, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DocumentNotAvailable } from '../DocumentNotAvailable';
import { compileProposalSchema } from '../forms/proposal';
import { ProposalFormRenderer } from '../proposalEditor/ProposalFormRenderer';
import { decisionRootHref } from '../proposalHrefs';
import { useLiveProposalDocument } from '../useLiveProposalDocument';
import { DevelopProposalEditor } from './DevelopProposalEditor';
import { DevelopProposalFrame } from './DevelopProposalFrame';
import { DevelopSourceColumn } from './DevelopSourceColumn';
import { getDevelopEntryHeading } from './getDevelopEntryHeading';

type DevelopSources = ComponentProps<typeof DevelopSourceColumn>['sources'];

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
  const heading = getDevelopEntryHeading({
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
    return readOnlyEntry;
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
  const [{ lock }] = trpc.decision.getCategoryDevelopmentState.useSuspenseQuery(
    {
      processInstanceId,
    },
  );

  if (lock === null && proposal.isEditable === true) {
    return editor;
  }

  if (lock !== null && proposal.status === ProposalStatus.DRAFT) {
    return notAdvancedEntry;
  }

  return readOnlyEntry;
}

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

function DevelopLockNotice({
  processInstanceId,
  isAdvancing,
}: {
  processInstanceId: string;
  isAdvancing: boolean;
}) {
  const t = useTranslations('decisions');
  const [{ lock }] = trpc.decision.getCategoryDevelopmentState.useSuspenseQuery(
    {
      processInstanceId,
    },
  );

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
