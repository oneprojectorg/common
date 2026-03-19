'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { notFound, useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { useEffect } from 'react';
import { LuHistory } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();
  const [aside, setAside] = useQueryState('aside', proposalEditorAsideParser);
  const t = useTranslations();

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

  const headerActions = isVersionHistoryEnabled ? (
    <TooltipTrigger>
      <button
        type="button"
        onClick={handleToggleVersionHistory}
        aria-label={t('Version history')}
        aria-pressed={isVersionHistoryOpen}
        className="flex size-8 items-center justify-center rounded-sm border border-offWhite bg-white text-primary-teal shadow-md hover:bg-neutral-offWhite hover:no-underline"
      >
        <LuHistory className="size-4" />
      </button>
      <Tooltip>{t('Version history')}</Tooltip>
    </TooltipTrigger>
  ) : null;

  // -- Render ----------------------------------------------------------------

  return (
    <ProposalEditor
      instance={instance}
      backHref={`/decisions/${slug}`}
      proposal={proposal}
      isEditMode
      headerActions={headerActions}
      sidebarSlot={sidebarSlot}
    />
  );
}
