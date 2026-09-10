'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { useRequiredUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  type Proposal,
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
import { useEffect, useMemo, useState } from 'react';
import { LuHistory, LuMessageSquareText } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CollaborativeDocProvider } from '@/components/collaboration';
import { FeedbackDotIconButton } from '@/components/decisions/FeedbackDotIconButton';
import { ProposalEditorAside as ProposalEditorAsideSheet } from '@/components/decisions/ProposalEditorAside';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
import { ProposalFeedbackPanel } from '@/components/decisions/ProposalFeedbackPanel';
import { ReviewNotesButton } from '@/components/decisions/ReviewNotesButton';
import { ReviewNotesPanel } from '@/components/decisions/ReviewNotesPanel';
import { getProposalAffordances } from '@/components/decisions/getProposalAffordances';
import { ProposalEditor } from '@/components/decisions/proposalEditor';
import { ProposalEditorAsidePane } from '@/components/decisions/proposalEditor/ProposalEditorAsidePane';
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
  proposalReviewNotesParser,
} from '@/components/decisions/proposalEditor/proposalEditorAsideParams';
import { useRestoreProposalVersion } from '@/components/decisions/proposalEditor/useRestoreProposalVersion';
import { useProposalFeedback } from '@/components/decisions/useProposalFeedback';

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
    {
      aside,
      versionId,
      reviewRevision,
      reviewNotes: isReviewNotesRequested,
      feedback: isFeedbackPanelOpen,
    },
    setQueryState,
  ] = useQueryStates({
    aside: proposalEditorAsideParser,
    versionId: proposalEditorVersionIdParser,
    reviewRevision: proposalEditorReviewRevisionParser,
    reviewNotes: proposalReviewNotesParser,
    feedback: proposalFeedbackPanelParser,
  });
  // Session-local: we hold no read state for revision requests, and the dot
  // only has to stop nagging once the author has looked at the sheet.
  const [hasOpenedReviewNotes, setHasOpenedReviewNotes] = useState(false);
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

  // Mirrors the server gate for both revision reads below: author standing,
  // decision admin, or review capability. Deliberately not `review.revisions` —
  // that adds a review-phase condition, and an author has to see a pending
  // request whatever phase the decision is in.
  const affordances = getProposalAffordances({ instance, proposal, user });

  // Gated rather than firing for every viewer and swallowing the server's
  // UnauthorizedError. The error-to-empty fallback stays for transport
  // failures, so the editor still loads.
  const { data: revisionData, error: revisionError } =
    trpc.decision.listProposalRevisionRequests.useQuery(
      {
        proposalId: proposal.id,
        states: [ProposalReviewRequestState.REQUESTED],
      },
      { enabled: affordances.review.feedback, throwOnError: false },
    );

  // One resubmission answers every one of these, so they are read as a set
  // rather than singled out by id.
  const openRevisionRequests = (
    revisionError ? [] : (revisionData?.items ?? [])
  ).map((item) => item.revisionRequest);

  const hasOpenRevisionRequests = openRevisionRequests.length > 0;

  // Same gate: the panel keeps showing this history after the review phase
  // ends, which is exactly when `review.revisions` would go false.
  const feedback = useProposalFeedback({
    proposalId: proposal.id,
    enabled: affordances.review.feedback,
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

  // `?reviewRevision=<id>` stays a working deep link from the notification
  // email: it names one request, but the sheet lists them all.
  const isReviewNotesOpen =
    hasOpenRevisionRequests &&
    (isReviewNotesRequested || Boolean(reviewRevision));

  const setReviewNotesOpen = (open: boolean) => {
    setHasOpenedReviewNotes(true);

    // Both are inline-end sheets; leaving the version history open would stack
    // one on top of the other.
    if (open) {
      setAsideState({ aside: null });
    }

    void setQueryState(
      { reviewNotes: open ? true : null, reviewRevision: null },
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

  // The review-notes sheet owns the open requests, so this disclosure is left
  // with the read-only record of a review that has already ended.
  const feedbackDisclosure =
    !hasOpenRevisionRequests && feedback.hasFeedback ? (
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

  const reviewNotesSlot =
    canInteract && hasOpenRevisionRequests ? (
      <ReviewNotesButton
        onToggle={() => setReviewNotesOpen(!isReviewNotesOpen)}
        isExpanded={isReviewNotesOpen}
        hasUnread={!hasOpenedReviewNotes && !isReviewNotesOpen}
      />
    ) : null;

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
          reviewNotesSlot={reviewNotesSlot}
          hasOpenRevisionRequests={hasOpenRevisionRequests}
          reviewNotesAside={
            <ProposalEditorAsideSheet
              open={isReviewNotesOpen}
              title={t('Review notes')}
              onClose={() => setReviewNotesOpen(false)}
            >
              <ReviewNotesPanel requests={openRevisionRequests} />
            </ProposalEditorAsideSheet>
          }
        >
          {isFeedbackPanelOpen && feedback.hasFeedback ? (
            <ProposalEditorAsidePane label={t('Feedback')}>
              <ProposalFeedbackPanel
                feedbackItems={feedback.notes}
                revisionRequests={feedback.revisionHistory}
                title={t('Feedback')}
                subtitle={t(
                  'Notes reviewers shared while this proposal was under review',
                )}
                revisionRequestLabel={t('Revision request')}
              />
            </ProposalEditorAsidePane>
          ) : null}
        </ProposalEditorContent>
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
  reviewNotesSlot,
  hasOpenRevisionRequests,
  reviewNotesAside,
  children,
}: {
  proposal: Proposal;
  instance: ProcessInstance;
  slug: string;
  fragmentNames: string[];
  asideState: ProposalEditorAsideState;
  setAsideState: (state: ProposalEditorAsideState) => void;
  asideHeaderIcons: React.ReactNode[];
  reviewNotesSlot: React.ReactNode;
  hasOpenRevisionRequests: boolean;
  /** The "Review notes" sheet — an overlay, so it sits outside the editor. */
  reviewNotesAside: React.ReactNode;
  /** The aside pane, forwarded straight to `ProposalEditor`. */
  children: React.ReactNode;
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
        reviewNotesSlot={reviewNotesSlot}
        hasOpenRevisionRequests={hasOpenRevisionRequests}
      >
        {children}
      </ProposalEditor>
      {reviewNotesAside}
      {/* Desktop: a non-modal sheet with no backdrop, so the document stays
          visible and scrollable beside it. Mobile: a modal drawer, which covers
          the viewport anyway. */}
      {asideSlot}
    </div>
  );
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
