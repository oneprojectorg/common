'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { PAGE_LIMIT, type Proposal, nextCursor } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { notFound } from 'next/navigation';
import { useId, useMemo, useState, useTransition } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';

import { CategoryFilterSelect } from '../CategoryFilterSelect';
import { ALL_CATEGORIES } from '../proposalFilterQuery';
import { proposalEditHref } from '../proposalHrefs';
import { DevelopEntriesTable } from './DevelopEntriesTable';
import { DevelopOriginsTable } from './DevelopOriginsTable';

/**
 * The develop screen's body: the previous phase's proposals (the origins),
 * filterable by category, each with a Prepare action that creates an entry in
 * the current phase and opens it in the proposal editor; below them, the
 * entries that exist in the current phase.
 *
 * The two lists are not joined: knowing which origin already has an entry
 * takes one relationship read per entry, so Prepare shows on every origin.
 */
export function DevelopProposalsListSuspense({
  instance,
  originPhaseId,
}: {
  instance: ProcessInstance;
  /** The phase the origins come from: the one before the develop phase. */
  originPhaseId: string;
}) {
  const t = useTranslations('decisions.develop');
  const router = useRouter();
  const utils = trpc.useUtils();
  const processInstanceId = instance.id;
  const decisionSlug = instance.slug;

  if (!decisionSlug) {
    notFound();
  }

  const originsHeadingId = useId();
  const entriesHeadingId = useId();
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  // A filter change keeps the current rows on screen while the next ones load,
  // instead of swapping the whole list for its skeleton.
  const [isFiltering, startFiltering] = useTransition();
  const [isNavigating, startNavigating] = useTransition();

  const originsInput = {
    processInstanceId,
    phaseId: originPhaseId,
    categoryId:
      selectedCategory === ALL_CATEGORIES ? undefined : selectedCategory,
    limit: PAGE_LIMIT.lg,
  };
  const originsOptions = { getNextPageParam: nextCursor };

  // Starts the origins read alongside the batch below, not after it.
  trpc.decision.listProposals.usePrefetchInfiniteQuery(originsInput, {
    ...originsOptions,
    pages: 1,
  });
  const [[{ items: categories }, entriesList]] = trpc.useSuspenseQueries(
    (q) => [
      q.decision.getCategories({ processInstanceId }),
      q.decision.listProposals({
        processInstanceId,
        phaseId: instance.currentStateId ?? undefined,
        limit: PAGE_LIMIT.max,
      }),
    ],
  );
  const [originPages, originsQuery] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(
      originsInput,
      originsOptions,
    );

  const origins = useMemo(
    () => originPages.pages.flatMap((page) => page.items),
    [originPages.pages],
  );
  const originsTotal = originPages.pages[0]?.total ?? 0;

  const editHref = (proposal: Pick<Proposal, 'profileId'>) =>
    proposalEditHref({
      decisionSlug,
      slug: decisionSlug,
      instanceId: processInstanceId,
      profileId: proposal.profileId,
    });

  const createEntry = trpc.decision.createDevelopedProposal.useMutation({
    onSuccess: (entry) => {
      void utils.decision.listProposals.invalidate({ processInstanceId });
      void utils.decision.getInstance.invalidate({
        instanceId: processInstanceId,
      });
      startNavigating(() => {
        router.push(editHref(entry));
      });
    },
    onError: (error) => {
      logger.error('Failed to prepare a develop entry', { error });
      toast.error(t('prepareEntryError'));
    },
  });

  const handlePrepare = (origin: Proposal) => {
    createEntry.mutate({
      processInstanceId,
      sourceProposalIds: [origin.id],
      proposalData: {
        title: origin.profile.name,
        category: origin.proposalData.category,
      },
    });
  };

  const isPreparing = createEntry.isPending || isNavigating;
  const preparingOriginId = isPreparing
    ? (createEntry.variables?.sourceProposalIds[0] ?? null)
    : null;

  return (
    <div className="flex flex-col gap-10 pb-20">
      <section
        aria-labelledby={originsHeadingId}
        className="flex flex-col gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Header3 id={originsHeadingId}>{t('originsHeading')}</Header3>
          {categories.length > 0 ? (
            <CategoryFilterSelect
              decisionSlug={decisionSlug}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(category) =>
                startFiltering(() => setSelectedCategory(category))
              }
            />
          ) : null}
        </div>

        <p
          aria-live="polite"
          aria-busy={isFiltering || undefined}
          className="text-sm text-muted-foreground"
        >
          {t('originsCount', { count: originsTotal })}
        </p>

        <DevelopOriginsTable
          origins={origins}
          onPrepare={handlePrepare}
          isPreparing={isPreparing}
          preparingOriginId={preparingOriginId}
        />

        {originsQuery.hasNextPage ? (
          <Button
            variant="outline"
            className="self-center"
            loading={originsQuery.isFetchingNextPage}
            onClick={() => void originsQuery.fetchNextPage()}
          >
            {t('loadMoreOriginsAction')}
          </Button>
        ) : null}
      </section>

      <section
        aria-labelledby={entriesHeadingId}
        className="flex flex-col gap-6"
      >
        <Header3 id={entriesHeadingId} className="flex items-center gap-2">
          {t('entriesHeading')}
          <Bullet />
          {entriesList.items.length}
        </Header3>
        <DevelopEntriesTable entries={entriesList.items} editHref={editHref} />
      </section>
    </div>
  );
}

export function DevelopProposalsListSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="flex w-full flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex w-full items-center justify-between gap-4 border-b border-border py-2"
          >
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-4 w-16 md:block" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
