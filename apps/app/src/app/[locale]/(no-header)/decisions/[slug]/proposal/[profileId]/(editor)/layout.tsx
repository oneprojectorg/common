'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { notFound, useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { useEffect } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { DocumentNotAvailable } from '@/components/decisions/DocumentNotAvailable';
import { ProposalEditor } from '@/components/decisions/proposalEditor';
import { ProposalVersionsAside } from '@/components/decisions/proposalEditor/asides/ProposalVersionsAside';
import { proposalEditorAsideParser } from '@/components/decisions/proposalEditor/proposalEditorAsideParams';

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
  return (
    <ErrorBoundary fallback={<DocumentNotAvailable />}>
      <ProposalEditorLayoutContent />
    </ErrorBoundary>
  );
}

function ProposalEditorLayoutContent() {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;
  const [aside, setAside] = useQueryState('aside', proposalEditorAsideParser);

  const isVersionHistoryEnabled = useFeatureFlag('proposal_version_history');
  const isVersionHistoryOpen = aside === 'versions';

  // -- Data fetching ---------------------------------------------------------

  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;

  const [[proposal, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposal({ profileId }),
    t.decision.getInstance({ instanceId }),
  ]);

  if (!proposal || !instance) {
    notFound();
  }

  useEffect(() => {
    if (isVersionHistoryOpen && !isVersionHistoryEnabled) {
      void setAside(null);
    }
  }, [isVersionHistoryEnabled, isVersionHistoryOpen, setAside]);

  const handleToggleVersionHistory = () => {
    void setAside(isVersionHistoryOpen ? null : 'versions', {
      history: 'push',
      scroll: false,
    });
  };

  const handleCloseAside = () => {
    void setAside(null, {
      history: 'push',
      scroll: false,
    });
  };

  const sidebarSlot =
    isVersionHistoryEnabled && isVersionHistoryOpen ? (
      <ProposalVersionsAside onClose={handleCloseAside} />
    ) : undefined;

  // -- Render ----------------------------------------------------------------

  return (
    <ProposalEditor
      instance={instance}
      backHref={`/decisions/${slug}`}
      proposal={proposal}
      headerMode={
        isVersionHistoryEnabled && isVersionHistoryOpen && !isMobile
          ? 'version'
          : 'edit'
      }
      isEditMode
      sidebarSlot={sidebarSlot}
      isVersionHistoryEnabled={isVersionHistoryEnabled}
      isVersionHistoryOpen={isVersionHistoryOpen}
      onToggleVersionHistory={handleToggleVersionHistory}
    />
  );
}
