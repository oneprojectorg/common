'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { notFound, useParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { LuHistory } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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

  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;

  const [[proposal, instance]] = trpc.useSuspenseQueries((query) => [
    query.decision.getProposal({ profileId }),
    query.decision.getInstance({ instanceId }),
  ]);

  if (!proposal || !instance) {
    notFound();
  }

  const { asideHeaderIcons, asideSlot } = useProposalEditorAside({
    aside,
    setAside,
    proposalId: proposal.id,
    isVersionHistoryEnabled: Boolean(isVersionHistoryEnabled),
    versionHistoryLabel: t('Version history'),
  });

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
      />
      {asideSlot}
    </div>
  );
}

function useProposalEditorAside({
  aside,
  setAside,
  proposalId,
  isVersionHistoryEnabled,
  versionHistoryLabel,
}: {
  aside: ProposalEditorAside | null;
  setAside: (
    value: ProposalEditorAside | null,
    options?: { history?: 'push' | 'replace'; scroll?: boolean },
  ) => Promise<URLSearchParams>;
  proposalId: string;
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
        <ProposalVersionsAside
          proposalId={proposalId}
          onClose={() => setActiveAside(null)}
        />
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
