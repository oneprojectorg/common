'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { getProposalFragmentNames, parseProposalData } from '@op/common/client';
import type { ProposalTemplateSchema } from '@op/common/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { notFound, useParams } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { LuHistory } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CollaborativeDocProvider } from '@/components/collaboration';
import { ProposalEditorSkeleton } from '@/components/decisions/ProposalEditorSkeleton';
import { ProposalEditor } from '@/components/decisions/proposalEditor';
import { VersionPreviewProvider } from '@/components/decisions/proposalEditor/VersionPreviewContext';
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
  const [{ aside, versionId }, setQueryState] = useQueryStates({
    aside: proposalEditorAsideParser,
    versionId: proposalEditorVersionIdParser,
  });
  const t = useTranslations();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const isVersionHistoryEnabled =
    useFeatureFlag('proposal_version_history') === true;

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

  const proposalTemplate = instance.instanceData
    ?.proposalTemplate as ProposalTemplateSchema | null;

  const fragmentNames = useMemo(
    () => (proposalTemplate ? getProposalFragmentNames(proposalTemplate) : []),
    [proposalTemplate],
  );

  const versionHistoryLabel = t('Version history');
  const asideState = isVersionHistoryEnabled
    ? getProposalEditorAsideState(
        normalizeProposalEditorAsideQueryState({ aside, versionId }),
      )
    : { aside: null };

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
    isVersionHistoryEnabled,
    versionHistoryLabel,
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
        onClose={() => setAsideState({ aside: null })}
      />
    ) : undefined;

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
      </VersionPreviewProvider>
    </CollaborativeDocProvider>
  );
}

function useProposalEditorAsideHeaderIcons({
  aside,
  onToggleAside,
  isVersionHistoryEnabled,
  versionHistoryLabel,
}: {
  aside: ProposalEditorAside | null;
  onToggleAside: (aside: ProposalEditorAside) => void;
  isVersionHistoryEnabled: boolean;
  versionHistoryLabel: string;
}) {
  const asideDefinitions = {
    versions: {
      icon: LuHistory,
      label: versionHistoryLabel,
      isEnabled: isVersionHistoryEnabled,
    },
  } satisfies Record<
    ProposalEditorAside,
    {
      icon: typeof LuHistory;
      label: string;
      isEnabled: boolean;
    }
  >;

  const activeAsideDefinition = aside ? asideDefinitions[aside] : null;
  const activeAside = activeAsideDefinition?.isEnabled ? aside : null;

  return proposalEditorAsideValues
    .filter((asideKey) => asideDefinitions[asideKey].isEnabled)
    .map((asideKey) => {
      const definition = asideDefinitions[asideKey];
      const Icon = definition.icon;

      return (
        <TooltipTrigger key={asideKey}>
          <button
            type="button"
            onClick={() => onToggleAside(asideKey)}
            aria-label={definition.label}
            aria-pressed={activeAside === asideKey}
            className="flex size-8 cursor-pointer items-center justify-center rounded-sm border border-offWhite bg-white text-primary-teal shadow-md hover:bg-neutral-offWhite hover:no-underline"
          >
            <Icon className="size-4" />
          </button>
          <Tooltip>{definition.label}</Tooltip>
        </TooltipTrigger>
      );
    });
}
