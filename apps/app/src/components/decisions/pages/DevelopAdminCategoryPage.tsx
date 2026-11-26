'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@op/sense/Empty';
import { Suspense } from 'react';
import { LuArrowLeft, LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

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
  /** The categories list, where Back leads. */
  backHref: string;
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
          <ButtonLink variant="link" size="inline" href={props.backHref}>
            <LuArrowLeft
              aria-hidden
              data-icon="inline-start"
              className="rtl:-scale-x-100"
            />
            {t('Back')}
          </ButtonLink>
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
}: DevelopAdminCategoryPageProps) {
  const [[{ items }, { lock }]] = trpc.useSuspenseQueries((q) => [
    q.decision.listCategoryReviewerStatus({ processInstanceId: instance.id }),
    q.decision.getDevelopConfirmState({ processInstanceId: instance.id }),
  ]);
  const status = items.find((item) => item.category.id === categoryId);

  if (!status) {
    return <CategoryNotFound />;
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

function CategoryNotFound() {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf aria-hidden className="size-5" />
        </EmptyMedia>
        <EmptyTitle render={<h2 />}>{t('categoryNotFoundTitle')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
