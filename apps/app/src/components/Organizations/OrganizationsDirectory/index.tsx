'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type RouterOutput, trpc } from '@op/api/client';
import { nextCursor } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Skeleton } from '@op/sense/Skeleton';
import { cn } from '@op/sense/lib/utils';
import { useQueryStates } from 'nuqs';
import { Suspense, useTransition } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import { ResponsiveSelect } from '@/components/decisions/ResponsiveSelect';

import {
  type Sort,
  directorySearchParams,
  getOrganizationListInput,
} from './searchParams';

type OrganizationProfile = RouterOutput['profile']['list']['items'][number];
type TermOption =
  RouterOutput['organization']['listFilterTerms']['focusAreas'][number];

const ALL = 'all';

export const OrganizationsDirectory = () => {
  const t = useTranslations('org');
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(directorySearchParams, {
    startTransition,
  });
  const { data: filterTerms, isPending: isLoadingTerms } =
    trpc.organization.listFilterTerms.useQuery(undefined, {
      staleTime: 5 * 60_000,
    });
  const input = getOrganizationListInput(filters, filterTerms);
  const hasTermFilter = Boolean(filters.focusArea || filters.strategy);

  return (
    <div className="flex flex-col gap-8">
      <div className="-mx-4 -my-1 no-scrollbar flex gap-3 overflow-x-auto px-4 py-1 *:shrink-0 sm:mx-0 sm:my-0 sm:gap-6 sm:overflow-visible sm:px-0 sm:py-0">
        <TermFilter
          options={filterTerms?.focusAreas ?? []}
          allLabel={t('allFocusAreasOption')}
          ariaLabel={t('focusAreaFilterLabel')}
          value={filters.focusArea}
          onChange={(focusArea) => setFilters({ focusArea })}
        />
        <TermFilter
          options={filterTerms?.strategies ?? []}
          allLabel={t('allStrategiesOption')}
          ariaLabel={t('strategyFilterLabel')}
          value={filters.strategy}
          onChange={(strategy) => setFilters({ strategy })}
        />
        <ResponsiveSelect<Sort>
          aria-label={t('sortLabel')}
          className="w-auto sm:w-40"
          selectedKey={filters.sort}
          onSelectionChange={(sort) => setFilters({ sort })}
          items={[
            { id: 'newest', label: t('sortNewest') },
            { id: 'oldest', label: t('sortOldest') },
            { id: 'name', label: t('sortName') },
          ]}
        />
      </div>

      <APIErrorBoundary
        resetKeys={[filters.focusArea, filters.strategy, filters.sort]}
        fallbacks={{
          default: () => (
            <p className="text-muted-foreground">{t('directoryLoadError')}</p>
          ),
        }}
      >
        {isLoadingTerms && hasTermFilter ? (
          <OrganizationListSkeleton />
        ) : (
          <Suspense fallback={<OrganizationListSkeleton />}>
            <OrganizationList input={input} isPending={isPending} />
          </Suspense>
        )}
      </APIErrorBoundary>
    </div>
  );
};

const TermFilter = ({
  options,
  allLabel,
  ariaLabel,
  value,
  onChange,
}: {
  options: TermOption[];
  allLabel: string;
  ariaLabel: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) => (
  <ResponsiveSelect
    aria-label={ariaLabel}
    className="w-auto sm:w-40"
    selectedKey={
      options.some(({ slug }) => slug === value) && value ? value : ALL
    }
    onSelectionChange={(slug) => onChange(slug === ALL ? null : slug)}
    items={[
      { id: ALL, label: allLabel },
      ...options.map(({ slug, label }) => ({ id: slug, label })),
    ]}
  />
);

const OrganizationList = ({
  input,
  isPending,
}: {
  input: ReturnType<typeof getOrganizationListInput>;
  isPending: boolean;
}) => {
  const t = useTranslations('org');
  const [{ pages }, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.profile.list.useSuspenseInfiniteQuery(input, {
      getNextPageParam: nextCursor,
      staleTime: 60_000,
    });

  const { ref, shouldShowTrigger } = useInfiniteScroll(fetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '100px',
  });

  const organizations = pages.flatMap((page) => page.items);

  return (
    <div
      aria-busy={isPending}
      className={cn('flex flex-col gap-8', isPending && 'opacity-60')}
    >
      <p aria-live="polite" className="sr-only">
        {organizations.length === 0
          ? t('directoryEmpty')
          : t('directoryResultCount', { count: organizations.length })}
      </p>
      {organizations.length === 0 ? (
        <p aria-hidden className="text-muted-foreground">
          {t('directoryEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-8">
          {organizations.map((organization) => (
            <li key={organization.id}>
              <OrganizationCard organization={organization} />
            </li>
          ))}
        </ul>
      )}
      {shouldShowTrigger && (
        <div ref={ref} className="flex justify-center">
          {isFetchingNextPage ? <OrganizationListSkeleton count={1} /> : null}
        </div>
      )}
    </div>
  );
};

const OrganizationCard = ({
  organization,
}: {
  organization: OrganizationProfile;
}) => (
  <Link
    href={`/org/${organization.slug}`}
    className="flex items-center gap-3 rounded-lg border p-4 text-foreground no-underline hover:bg-muted hover:no-underline"
  >
    <ProfileAvatar
      name={organization.name}
      src={getPublicUrl(organization.avatarImage?.name)}
      alt=""
      size="lg"
      className="size-12"
    />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span
        dir="auto"
        className="truncate font-strong ltr:text-left rtl:text-right"
      >
        {organization.name}
      </span>
      {organization.bio ? (
        <span dir="auto" className="truncate ltr:text-left rtl:text-right">
          {organization.bio}
        </span>
      ) : null}
    </div>
  </Link>
);

const OrganizationListSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="flex w-full flex-col gap-8">
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} className="h-22 w-full rounded-lg" />
    ))}
  </div>
);
