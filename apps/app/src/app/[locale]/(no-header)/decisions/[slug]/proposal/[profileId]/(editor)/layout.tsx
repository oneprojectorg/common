'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import type { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  getProposalFragmentNames,
  parseProposalData,
} from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { notFound, useParams } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { LuHistory, LuStickyNote } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CollaborativeDocProvider } from '@/components/collaboration';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
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
  proposalEditorReviewRevisionParser,
  proposalEditorVersionIdParser,
} from '@/components/decisions/proposalEditor/proposalEditorAsideParams';
import { useRestoreProposalVersion } from '@/components/decisions/proposalEditor/useRestoreProposalVersion';

type RevisionRequestEntries =
  RouterOutput['decision']['listProposalRevisionRequests']['revisionRequests'];

const RevisionRequestsContext = createContext<RevisionRequestEntries>([]);

/**
 * Shared layout for the proposal editor route.
 *
 * Persists across query string updates so the collaborative editor,
 * Yjs connection, and draft state are never remounted while the aside
 * panel is opened or closed.
 */
export default function ProposalEditorLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();

  const [[decisionProfile, proposal]] = trpc.useSuspenseQueries((t) => [
    t.decision.getDecisionBySlug({ slug }),
    t.decision.getProposal({ profileId }),
  ]);

  if (!decisionProfile?.processInstance || !proposal) {
    notFound();
  }

  const instance = decisionProfile.processInstance;

  return (
    <RevisionRequestsBoundary proposalId={proposal.id}>
      <ProposalEditorLayoutInner
        instance={instance}
        proposal={proposal}
        slug={slug}
      />
    </RevisionRequestsBoundary>
  );
}

/**
 * Isolates listProposalRevisionRequests from the rest of the editor. The
 * server throws UnauthorizedError (403) when the viewer lacks review access;
 * we treat that as "no revision requests" so the editor still loads instead
 * of bubbling up to the [locale] error boundary.
 */
function RevisionRequestsBoundary({
  proposalId,
  children,
}: {
  proposalId: string;
  children: ReactNode;
}) {
  return (
    <APIErrorBoundary fallbacks={{ 403: () => <>{children}</> }}>
      <RevisionRequestsProvider proposalId={proposalId}>
        {children}
      </RevisionRequestsProvider>
    </APIErrorBoundary>
  );
}

function RevisionRequestsProvider({
  proposalId,
  children,
}: {
  proposalId: string;
  children: ReactNode;
}) {
  const [{ revisionRequests }] =
    trpc.decision.listProposalRevisionRequests.useSuspenseQuery({
      proposalId,
      states: [ProposalReviewRequestState.REQUESTED],
    });

  return (
    <RevisionRequestsContext.Provider value={revisionRequests}>
      {children}
    </RevisionRequestsContext.Provider>
  );
}

function ProposalEditorLayoutInner({
  instance,
  proposal,
  slug,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  slug: string;
}) {
  const [{ aside, versionId, reviewRevision }, setQueryState] = useQueryStates({
    aside: proposalEditorAsideParser,
    versionId: proposalEditorVersionIdParser,
    reviewRevision: proposalEditorReviewRevisionParser,
  });
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
  const { user } = useUser();

  const revisionRequests = useContext(RevisionRequestsContext);

  const revisionRequest: ProposalReviewRequest | null = reviewRevision
    ? (revisionRequests.find((r) => r.revisionRequest.id === reviewRevision)
        ?.revisionRequest ?? null)
    : null;

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

  const revisionRequestLabel = t('Revision request');
  const headerIcons = firstRevisionRequestId
    ? [
        <TooltipTrigger key="revision-request">
          <Button
            color="secondary"
            variant="icon"
            size="small"
            onPress={toggleRevisionRequest}
            aria-label={revisionRequestLabel}
            aria-pressed={Boolean(reviewRevision)}
            className="relative size-8 min-w-8 rounded-sm p-0"
          >
            <LuStickyNote className="size-4" />
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary-orange2"
            />
          </Button>
          <Tooltip>{revisionRequestLabel}</Tooltip>
        </TooltipTrigger>,
        ...asideHeaderIcons,
      ]
    : asideHeaderIcons;

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
          isMobile={isMobile}
          revisionRequest={revisionRequest}
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
  isMobile,
  revisionRequest,
}: {
  proposal: Proposal;
  instance: ProcessInstance;
  slug: string;
  fragmentNames: string[];
  asideState: ProposalEditorAsideState;
  setAsideState: (state: ProposalEditorAsideState) => void;
  asideHeaderIcons: React.ReactNode[];
  isMobile: boolean;
  revisionRequest: ProposalReviewRequest | null;
}) {
  const versionPreview = useOptionalVersionPreview();

  const { restoreVersion } = useRestoreProposalVersion({
    proposalId: proposal.id,
    proposalData: proposal.proposalData,
    fragmentNames,
  });

  const asideSlot =
    asideState.aside === 'versions' ? (
      <ProposalVersionsAside
        versionId={asideState.versionId}
        onSelectVersion={(nextVersionId) =>
          setAsideState({
            aside: 'versions',
            versionId: nextVersionId,
          })
        }
        onRestoreVersion={async (versionId) => {
          await restoreVersion(
            versionId,
            versionPreview?.fragmentContents ?? {},
          );
          setAsideState({ aside: 'versions', versionId: null });
        }}
        onClose={() => setAsideState({ aside: null })}
      />
    ) : undefined;

  return (
    <div className="flex h-screen bg-white">
      <ProposalEditor
        instance={instance}
        backHref={`/decisions/${slug}`}
        proposal={proposal}
        isEditMode
        asideHeaderIcons={
          asideHeaderIcons.length > 0 ? asideHeaderIcons : undefined
        }
        showHeaderActions={isMobile || !asideSlot}
        revisionRequest={revisionRequest}
      />
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
      <TooltipTrigger key={asideKey}>
        <Button
          color="secondary"
          variant="icon"
          size="small"
          onPress={() => onToggleAside(asideKey)}
          aria-label={definition.label}
          aria-pressed={aside === asideKey}
          className="size-8 min-w-8 rounded-sm p-0"
        >
          <Icon className="size-4" />
        </Button>
        <Tooltip>{definition.label}</Tooltip>
      </TooltipTrigger>
    );
  });
}
