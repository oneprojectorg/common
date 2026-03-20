'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { parseProposalData } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { notFound, useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { LuHistory } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CollaborativeDocProvider } from '@/components/collaboration';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
import { ProposalEditor } from '@/components/decisions/proposalEditor';
import { ProposalVersionsAside } from '@/components/decisions/proposalEditor/asides/ProposalVersionsAside';
import {
  type ProposalEditorAside,
  proposalEditorAsideParser,
  proposalEditorAsideValues,
} from '@/components/decisions/proposalEditor/proposalEditorAsideParams';

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
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const isVersionHistoryEnabled = useFeatureFlag('proposal_version_history');

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

  const { user } = useUser();

  const { asideHeaderIcons, asideSlot } = useProposalEditorAside({
    aside,
    setAside,
    isVersionHistoryEnabled: Boolean(isVersionHistoryEnabled),
    versionHistoryLabel: t('Version history'),
  });

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal.proposalData,
    );

    return (
      existingId ??
      `proposal-${instance.id}-${proposal.id ?? crypto.randomUUID()}`
    );
  }, [proposal.proposalData, proposal.id, instance.id]);

  const userName = user.profile?.name ?? t('Anonymous');

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      userName={userName}
      fallback={<ProposalEditorSkeleton />}
    >
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
        />
        {asideSlot}
      </div>
    </CollaborativeDocProvider>
  );
}

function useProposalEditorAside({
  aside,
  setAside,
  isVersionHistoryEnabled,
  versionHistoryLabel,
}: {
  aside: ProposalEditorAside | null;
  setAside: (
    value: ProposalEditorAside | null,
    options?: { history?: 'push' | 'replace'; scroll?: boolean },
  ) => Promise<URLSearchParams>;
  isVersionHistoryEnabled: boolean;
  versionHistoryLabel: string;
}) {
  const setActiveAside = (nextAside: ProposalEditorAside | null) => {
    void setAside(nextAside, {
      history: 'push',
      scroll: false,
    });
  };

  const asideDefinitions = {
    versions: {
      icon: LuHistory,
      label: versionHistoryLabel,
      isEnabled: isVersionHistoryEnabled,
      renderPanel: () => (
        <ProposalVersionsAside onClose={() => setActiveAside(null)} />
      ),
    },
  } satisfies Record<
    ProposalEditorAside,
    {
      icon: typeof LuHistory;
      label: string;
      isEnabled: boolean;
      renderPanel: () => React.ReactNode;
    }
  >;

  const activeAsideDefinition = aside ? asideDefinitions[aside] : null;
  const activeAside = activeAsideDefinition?.isEnabled ? aside : null;

  const toggleAside = (nextAside: ProposalEditorAside) => {
    setActiveAside(activeAside === nextAside ? null : nextAside);
  };

  const asideSlot =
    activeAside && activeAsideDefinition
      ? activeAsideDefinition.renderPanel()
      : undefined;

  const asideHeaderIcons = proposalEditorAsideValues
    .filter((asideKey) => asideDefinitions[asideKey].isEnabled)
    .map((asideKey) => {
      const definition = asideDefinitions[asideKey];
      const Icon = definition.icon;

      return (
        <TooltipTrigger key={asideKey}>
          <button
            type="button"
            onClick={() => toggleAside(asideKey)}
            aria-label={definition.label}
            aria-pressed={activeAside === asideKey}
            className="flex size-8 items-center justify-center rounded-sm border border-offWhite bg-white text-primary-teal shadow-md hover:bg-neutral-offWhite hover:no-underline"
          >
            <Icon className="size-4" />
          </button>
          <Tooltip>{definition.label}</Tooltip>
        </TooltipTrigger>
      );
    });

  return {
    asideHeaderIcons,
    asideSlot,
  };
}
