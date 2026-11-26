'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { Suspense, useEffect } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { DevelopAdminCategoryFooter } from '../DevelopProposals/DevelopAdminCategoryFooter';
import {
  DevelopSourcesPanel,
  DevelopSourcesReadOnlyPanel,
  DevelopSourcesTableSkeleton,
} from '../DevelopProposals/DevelopSourcesPanel';
import {
  getDevelopSourceScope,
  getDevelopSourcesInput,
} from '../DevelopProposals/developSources';
import { ProposalsLoadError } from '../ProposalsLoadError';
import { DevelopPageContent } from './DevelopPageShell';

interface DevelopAdminCategoryPageProps {
  instance: ProcessInstance;
  sourcePhase: InstancePhaseData | null;
  decisionSlug: string;
  categoryId: string;
  /** Returns to the categories list. */
  onBack: () => void;
}

/**
 * One category of the admin's develop screen: its sources with the author's
 * Prepare, Edit and Advance, and a footer to confirm or unconfirm the
 * category, while the develop window is open; once it closed, only whether
 * each source advances.
 */
export function DevelopAdminCategoryPage(props: DevelopAdminCategoryPageProps) {
  const t = useTranslations();

  return (
    <DevelopPageContent>
      <div className="flex flex-col gap-6">
        <div>
          <Button variant="link" size="inline" onClick={props.onBack}>
            <LuArrowLeft
              aria-hidden
              data-icon="inline-start"
              className="rtl:-scale-x-100"
            />
            {t('Back')}
          </Button>
        </div>

        <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
          <Suspense fallback={<DevelopSourcesTableSkeleton />}>
            <DevelopAdminCategorySourcesSuspense {...props} />
          </Suspense>
        </APIErrorBoundary>
      </div>
    </DevelopPageContent>
  );
}

function DevelopAdminCategorySourcesSuspense({
  instance,
  sourcePhase,
  decisionSlug,
  categoryId,
  onBack,
}: DevelopAdminCategoryPageProps) {
  const [[{ items }, { lock }]] = trpc.useSuspenseQueries((q) => [
    q.decision.listCategoryReviewerStatus({ processInstanceId: instance.id }),
    q.decision.getDevelopConfirmState({ processInstanceId: instance.id }),
  ]);
  const status = items.find((item) => item.category.id === categoryId);
  const isKnownCategory = Boolean(status);

  // The id comes from the URL: go back when it names no category.
  useEffect(() => {
    if (!isKnownCategory) {
      onBack();
    }
  }, [isKnownCategory, onBack]);

  if (!status) {
    return null;
  }

  const panelProps = {
    instance,
    sourcePhase,
    decisionSlug,
    category: { id: status.category.id, name: status.category.name },
  };

  // An admin has no confirm lock, so only the closed window locks them.
  if (lock !== null) {
    return <DevelopSourcesReadOnlyPanel {...panelProps} />;
  }

  return (
    <>
      <DevelopSourcesPanel {...panelProps} />
      <DevelopAdminCategoryFooter
        processInstanceId={instance.id}
        status={status}
        sourcesInput={
          sourcePhase
            ? getDevelopSourcesInput({
                processInstanceId: instance.id,
                sourcePhaseId: sourcePhase.phaseId,
                scope: getDevelopSourceScope(instance),
                categoryId: status.category.id,
              })
            : undefined
        }
      />
    </>
  );
}
