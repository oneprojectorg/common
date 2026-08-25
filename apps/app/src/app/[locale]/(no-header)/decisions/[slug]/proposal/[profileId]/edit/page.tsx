'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { useRequiredUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  getProposalFragmentNames,
  parseProposalData,
} from '@op/common/client';
import { APP_NAME } from '@op/core';
import { Button } from '@op/sense/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import { notFound, useParams } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useEffect, useMemo } from 'react';
import { LuHistory, LuMessageSquareText, LuStickyNote } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CollaborativeDocProvider } from '@/components/collaboration';
import { FeedbackDotIconButton } from '@/components/decisions/FeedbackDotIconButton';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
import { ProposalFeedbackPanel } from '@/components/decisions/ProposalFeedbackPanel';
import { getProposalVisibility } from '@/components/decisions/getProposalVisibility';
import { ProposalEditor } from '@/components/decisions/proposalEditor';
import { RevisionFeedbackPanel } from '@/components/decisions/proposalEditor/RevisionFeedbackPanel';
import { VersionPreviewProvider } from '@/components/decisions/proposalEditor/VersionPreviewContext';
import { useOptionalVersionPreview } from '@/components/decisions/proposalEditor/VersionPreviewContext';
import { ProposalVersionsAside } from '@/components/decisions/proposalEditor/asides/ProposalVersionsAside';
import {
  type ProposalEditorAside,
  type ProposalEditorAsideState,
  getProposalEditorAsideDefaultState,
  getProposalEditorAsideQuery,
  getProposalEditorAsideState,
  normalizeProposalEditorAsideQueryState,
  proposalEditorAsideParser,
  proposalEditorAsideValues,
  proposalEditorReviewRevisionParser,
  proposalEditorVersionIdParser,
  proposalFeedbackPanelParser,
} from '@/components/decisions/proposalEditor/proposalEditorAsideParams';
import { useRestoreProposalVersion } from '@/components/decisions/proposalEditor/useRestoreProposalVersion';
import {
  type ProposalFeedback,
  useProposalFeedback,
} from '@/components/decisions/useProposalFeedback';

/**
 * Route page for the proposal editor.
 *
 * A single client component so the collaborative editor, Yjs connection, and
 * draft state stay mounted while the aside panel is opened or closed via the
 * query string (nuqs shallow updates don't remount this tree).
 */
export default function EditProposalPage() {
  // The suspense queries below throw NOT_FOUND (missing/malformed proposal) or
  // FORBIDDEN (no access); translate those to accurate 404/403 pages instead of
  // letting them bubble to error.tsx as a 500.
  return (
    <ResourceErrorBoundary>
      <EditProposalPageContent />
    </ResourceErrorBoundary>
  );
}

function EditProposalPageContent() {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();
  const [
    { aside, versionId, reviewRevision, feedback: isFeedbackPanelOpen },
    setQueryState,
  ] = useQueryStates({
    aside: proposalEditorAsideParser,
    versionId: proposalEditorVersionIdParser,
    reviewRevision: proposalEditorReviewRevisionParser,
    feedback: proposalFeedbackPanelParser,
  });
  const t = useTranslations();

  // -- Data fetching ---------------------------------------------------------

  const [[decisionProfile, proposal]] = trpc.useSuspenseQueries((t) => [
    t.decision.getDecisionBySlug({ slug }),
    t.decision.getProposal({ profileId }),
  ]);

  if (!decisionProfile?.processInstance || !proposal) {
    notFound();
  }

  const instance = decisionProfile.processInstance;

  const proposalTitle = proposal.profile?.name;
  useEffect(() => {
    const parts = [
      proposalTitle ? `${proposalTitle} (${t('Editing')})` : null,
      decisionProfile.name,
      APP_NAME,
    ].filter(Boolean);
    document.title = parts.join(' | ');
  }, [proposalTitle, decisionProfile.name, t]);

  const { user } = useRequiredUser();

  // The server throws UnauthorizedError when the viewer lacks review access;
  // treat any error as "no revision requests" so the editor still loads.
  const { data: revisionData, error: revisionError } =
    trpc.decision.listProposalRevisionRequests.useQuery(
      {
        proposalId: proposal.id,
        states: [ProposalReviewRequestState.REQUESTED],
      },
      { throwOnError: false, retry: false },
    );

  const revisionRequests = revisionError
    ? []
    : (revisionData?.revisionRequests ?? []);

  const activeRevisionRequest: ProposalReviewRequest | null = reviewRevision
    ? (revisionRequests.find((r) => r.revisionRequest.id === reviewRevision)
        ?.revisionRequest ?? null)
    : null;

  // Shared with the view route so the rule lives in one place; only
  // `review.feedback` applies here — the revision panes are that route's
  // affordance.
  const visibility = getProposalVisibility({ instance, proposal, user });

  // `review.feedback`, not `review.revisions`: this is the history the panel
  // keeps showing after the review phase ends, which is when `revisions` goes
  // false.
  const feedback = useProposalFeedback({
    proposalId: proposal.id,
    enabled: visibility.review.feedback,
  });

  const proposalTemplate = instance.instanceData.proposalTemplate;

  const fragmentNames = useMemo(
    () => (proposalTemplate ? getProposalFragmentNames(proposalTemplate) : []),
    [proposalTemplate],
  );

  const versionHistoryLabel = t('Version history');
  const asideState = getProposalEditorAsideState(
    normalizeProposalEditorAsideQueryState({ aside, versionId }),
  );

  const setAsideState = (nextState: ProposalEditorAsideState) => {
    void setQueryState(getProposalEditorAsideQuery(nextState), {
      history: 'push',
      scroll: false,
    });
  };

  const toggleAside = (nextAside: ProposalEditorAside) => {
    setAsideState(
      asideState.aside === nextAside
        ? { aside: null }
        : getProposalEditorAsideDefaultState(nextAside),
    );
  };

  const asideHeaderIcons = useProposalEditorAsideHeaderIcons({
    aside: asideState.aside,
    onToggleAside: toggleAside,
    versionHistoryLabel,
  });

  const firstRevisionRequestId =
    revisionRequests[0]?.revisionRequest.id ?? null;

  const toggleRevisionRequest = () => {
    if (!firstRevisionRequestId) {
      return;
    }

    void setQueryState(
      {
        reviewRevision:
          reviewRevision === firstRevisionRequestId
            ? null
            : firstRevisionRequestId,
      },
      { history: 'push', scroll: false },
    );
  };

  const toggleFeedbackPanel = () => {
    void setQueryState(
      { feedback: isFeedbackPanelOpen ? null : true },
      { history: 'push', scroll: false },
    );
  };

  // The version-history and revision-request controls are interactive editing
  // surfaces — hide them from anonymous accounts and logged-out visitors.
  const canInteract = userCanInteract(user);

  // One disclosure, whichever pane applies: mid-phase it opens the revision
  // request the author must answer, and the feedback record once that is gone.
  const feedbackDisclosure = firstRevisionRequestId ? (
    <FeedbackDotIconButton
      key="revision-request"
      icon={LuStickyNote}
      label={t('Revision request')}
      onToggle={toggleRevisionRequest}
      isExpanded={Boolean(reviewRevision)}
    />
  ) : feedback.hasFeedback ? (
    <FeedbackDotIconButton
      key="feedback"
      icon={LuMessageSquareText}
      label={t('Feedback')}
      onToggle={toggleFeedbackPanel}
      isExpanded={isFeedbackPanelOpen}
    />
  ) : null;

  const headerIcons = !canInteract
    ? []
    : [
        ...(feedbackDisclosure ? [feedbackDisclosure] : []),
        ...asideHeaderIcons,
      ];

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal.proposalData,
    );

    if (existingId) {
      return existingId;
    }

    throw new Error(
      'Legacy proposals without collaboration documents cannot be edited',
    );
  }, [proposal.proposalData]);

  const userName = user.profile?.name ?? t('Anonymous');

  const asidePanel = useProposalEditorAsidePanel({
    activeRevisionRequest,
    feedback,
    isFeedbackPanelOpen,
  });

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      userName={userName}
      fallback={<ProposalEditorSkeleton />}
    >
      <VersionPreviewProvider
        versionId={
          asideState.aside === 'versions' ? asideState.versionId : null
        }
        fragmentNames={fragmentNames}
      >
        <ProposalEditorContent
          proposal={proposal}
          instance={instance}
          slug={slug}
          fragmentNames={fragmentNames}
          asideState={asideState}
          setAsideState={setAsideState}
          asideHeaderIcons={headerIcons}
          activeRevisionRequest={activeRevisionRequest}
          asidePanel={asidePanel}
        />
      </VersionPreviewProvider>
    </CollaborativeDocProvider>
  );
}

/**
 * Inner content rendered within the collaborative document providers.
 *
 * Separated from the layout so hooks that depend on `CollaborativeDocProvider`
 * and `VersionPreviewProvider` (like `useRestoreProposalVersion`) can safely
 * access those contexts.
 */
function ProposalEditorContent({
  proposal,
  instance,
  slug,
  fragmentNames,
  asideState,
  setAsideState,
  asideHeaderIcons,
  activeRevisionRequest,
  asidePanel,
}: {
  proposal: Proposal;
  instance: ProcessInstance;
  slug: string;
  fragmentNames: string[];
  asideState: ProposalEditorAsideState;
  setAsideState: (state: ProposalEditorAsideState) => void;
  asideHeaderIcons: React.ReactNode[];
  activeRevisionRequest: ProposalReviewRequest | null;
  asidePanel: { label: string; content: React.ReactNode } | null;
}) {
  const versionPreview = useOptionalVersionPreview();

  const { restoreVersion } = useRestoreProposalVersion({
    proposalId: proposal.id,
    proposalData: proposal.proposalData,
    fragmentNames,
  });

  // Always mounted, toggled via `open` — conditionally rendering the aside
  // unmounts the base-ui dialog root on close, which skips its exit animation.
  const isVersionsAsideOpen = asideState.aside === 'versions';

  const asideSlot = (
    <ProposalVersionsAside
      open={isVersionsAsideOpen}
      versionId={isVersionsAsideOpen ? asideState.versionId : null}
      onSelectVersion={(nextVersionId) =>
        setAsideState({
          aside: 'versions',
          versionId: nextVersionId,
        })
      }
      onRestoreVersion={async (versionId) => {
        const restored = await restoreVersion(
          versionId,
          versionPreview?.fragmentContents ?? {},
        );

        // Only on success, and closing rather than deselecting: it hands the
        // editor back so the restored content is immediately editable instead
        // of sitting behind a readonly preview. A refused restore leaves the
        // aside open on the version the user picked.
        if (restored) {
          setAsideState({ aside: null });
        }
      }}
      onClose={() => setAsideState({ aside: null })}
    />
  );

  return (
    <div
      className={cn(
        'flex h-screen bg-background transition-[padding]',
        isVersionsAsideOpen && 'sm:pe-96',
      )}
    >
      <ProposalEditor
        instance={instance}
        backHref={`/decisions/${slug}/current`}
        proposal={proposal}
        isEditMode
        asideHeaderIcons={
          asideHeaderIcons.length > 0 ? asideHeaderIcons : undefined
        }
        activeRevisionRequest={activeRevisionRequest}
        asidePanel={asidePanel}
      />
      {/* Desktop: a non-modal sheet with no backdrop, so the document stays
          visible and scrollable beside it. Mobile: a modal drawer, which covers
          the viewport anyway. */}
      {asideSlot}
    </div>
  );
}

/**
 * The pane the document sits beside. A revision request the author still has to
 * answer outranks the read-only record of a review that has already ended.
 */
function useProposalEditorAsidePanel({
  activeRevisionRequest,
  feedback,
  isFeedbackPanelOpen,
}: {
  activeRevisionRequest: ProposalReviewRequest | null;
  feedback: ProposalFeedback;
  isFeedbackPanelOpen: boolean;
}): { label: string; content: React.ReactNode } | null {
  const t = useTranslations();

  if (activeRevisionRequest) {
    return {
      label: t('Revision feedback'),
      content: (
        <RevisionFeedbackPanel revisionRequest={activeRevisionRequest} />
      ),
    };
  }

  if (!isFeedbackPanelOpen || !feedback.hasFeedback) {
    return null;
  }

  return {
    label: t('Feedback'),
    content: (
      <ProposalFeedbackPanel
        feedbackItems={feedback.notes}
        revisionRequests={feedback.revisionHistory}
        title={t('Feedback')}
        subtitle={t(
          'Notes reviewers shared while this proposal was under review',
        )}
        revisionRequestLabel={t('Revision request')}
      />
    ),
  };
}

function useProposalEditorAsideHeaderIcons({
  aside,
  onToggleAside,
  versionHistoryLabel,
}: {
  aside: ProposalEditorAside | null;
  onToggleAside: (aside: ProposalEditorAside) => void;
  versionHistoryLabel: string;
}) {
  const asideDefinitions = {
    versions: {
      icon: LuHistory,
      label: versionHistoryLabel,
    },
  } satisfies Record<
    ProposalEditorAside,
    {
      icon: typeof LuHistory;
      label: string;
    }
  >;

  return proposalEditorAsideValues.map((asideKey) => {
    const definition = asideDefinitions[asideKey];
    const Icon = definition.icon;

    return (
      <Tooltip key={asideKey}>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              onClick={() => onToggleAside(asideKey)}
              aria-label={definition.label}
              aria-expanded={aside === asideKey}
            >
              <Icon className="size-4" />
            </Button>
          }
        />
        <TooltipContent>{definition.label}</TooltipContent>
      </Tooltip>
    );
  });
}
