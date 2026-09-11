'use client';

import { ResourceErrorBoundary } from '@/utils/ResourceErrorBoundary';
import { useRequiredUser } from '@/utils/UserProvider';
import { userCanInteract } from '@/utils/userCanInteract';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  type Proposal,
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
import { LuHistory } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CollaborativeDocProvider } from '@/components/collaboration';
import { ProposalEditorAside as ProposalEditorAsideSheet } from '@/components/decisions/ProposalEditorAside';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
import { ReviewNotesButton } from '@/components/decisions/ReviewNotesButton';
import { ReviewNotesPanel } from '@/components/decisions/ReviewNotesPanel';
import { getProposalAffordances } from '@/components/decisions/getProposalAffordances';
import { ProposalEditor } from '@/components/decisions/proposalEditor';
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
  proposalEditorVersionIdParser,
} from '@/components/decisions/proposalEditor/proposalEditorAsideParams';
import { useRestoreProposalVersion } from '@/components/decisions/proposalEditor/useRestoreProposalVersion';
import { useProposalReviewNotes } from '@/components/decisions/useProposalReviewNotes';

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
  const [{ aside, versionId }, setQueryState] = useQueryStates({
    aside: proposalEditorAsideParser,
    versionId: proposalEditorVersionIdParser,
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

  // Not `review.revisions`: an author sees a pending request in any phase.
  const affordances = getProposalAffordances({ instance, proposal, user });

  const isAuthor =
    !!user.currentProfile?.id &&
    proposal.submittedBy?.id === user.currentProfile.id;

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

  // Gated rather than firing for every viewer and swallowing a 403.
  const reviewNotes = useProposalReviewNotes({
    proposalId: proposal.id,
    phaseId: instance.currentStateId,
    enabled: affordances.review.feedback,
    // Both are inline-end sheets, so they would otherwise stack.
    onOpen: () => setAsideState({ aside: null }),
  });

  const hasOpenRevisionRequests = reviewNotes.openRequests.length > 0;

  // The version-history and revision-request controls are interactive editing
  // surfaces — hide them from anonymous accounts and logged-out visitors.
  const canInteract = userCanInteract(user);

  const headerIcons = !canInteract ? [] : asideHeaderIcons;

  const reviewNotesSlot =
    canInteract && reviewNotes.hasReviewNotes ? (
      <ReviewNotesButton
        onToggle={reviewNotes.toggle}
        isExpanded={reviewNotes.isOpen}
        hasUnread={reviewNotes.hasUnread}
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
        >
          <ProposalEditorAsideSheet
            open={reviewNotes.isOpen}
            title={t('Review notes')}
            onClose={() => reviewNotes.setOpen(false)}
          >
            <ReviewNotesPanel
              openRequests={reviewNotes.openRequests}
              noteGroups={reviewNotes.noteGroups}
              feedbackNotes={reviewNotes.feedbackNotes}
              isAuthor={isAuthor}
            />
          </ProposalEditorAsideSheet>
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
        // Only the version history reserves the gutter; it previews a version
        // beside the live document. The review-notes sheet slides over instead.
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
      />
      {children}
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
