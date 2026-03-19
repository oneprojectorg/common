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

  const setActiveAside = (nextAside: ProposalEditorAside | null) => {
    void setAside(nextAside, {
      history: 'push',
      scroll: false,
    });
  };

  const asideDefinitions = {
    versions: {
      icon: LuHistory,
      label: t('Version history'),
      isEnabled: Boolean(isVersionHistoryEnabled),
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

  const sidebarSlot =
    activeAside && activeAsideDefinition
      ? activeAsideDefinition.renderPanel()
      : undefined;

  const headerActions = proposalEditorAsideValues
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

  // -- Render ----------------------------------------------------------------

  return (
    <div className="flex h-screen bg-white">
      <ProposalEditor
        instance={instance}
        backHref={`/decisions/${slug}`}
        proposal={proposal}
        isEditMode
        headerActions={headerActions.length > 0 ? headerActions : undefined}
        showHeaderActions={isMobile || !sidebarSlot}
      />
      {sidebarSlot}
    </div>
  );
}
