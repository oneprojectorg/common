'use client';

import { getPublicUrl } from '@/utils';
import { type RouterOutput, trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { PAGE_LIMIT, nextCursor } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useState } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ResponsiveSelect } from '@/components/decisions/ResponsiveSelect';

type OrganizationsPage = RouterOutput['profile']['list'];
type OrganizationProfile = OrganizationsPage['items'][number];
type TermTree = RouterOutput['taxonomy']['getTerms']['items'];

type Sort = 'newest' | 'oldest' | 'name';

/** Sentinel for "no filter" — a select needs a string value. */
const ALL = 'all';

const FOCUS_AREA_TAXONOMY = 'necSimple:focusArea';
const STRATEGY_TAXONOMY = 'splcStrategies';

const SORT_INPUT = {
  newest: { orderBy: 'createdAt', dir: 'desc' },
  oldest: { orderBy: 'createdAt', dir: 'asc' },
  name: { orderBy: 'name', dir: 'asc' },
} as const;

/**
 * The Organizations page body (Figma 21478:65267): filter by focus area and
 * strategy, sort, and an infinitely scrolling list of organization cards.
 */
export const OrganizationsDirectory = ({
  initialData,
}: {
  /** Server-fetched first page for the default view (Newest, no filters). */
  initialData?: OrganizationsPage;
}) => {
  const t = useTranslations('org');
  const [focusAreaId, setFocusAreaId] = useState<string>(ALL);
  const [strategyId, setStrategyId] = useState<string>(ALL);
  const [sort, setSort] = useState<Sort>('newest');

  const isDefaultView =
    focusAreaId === ALL && strategyId === ALL && sort === 'newest';

  return (
    <div className="flex flex-col gap-8">
      {/* On a phone the selects stay on one row and scroll sideways, bleeding
          to the screen edges (cancelling ListPageLayout's px-4). py-1 keeps
          focus rings from being clipped by the scroll container. */}
      <div className="-mx-4 -my-1 no-scrollbar flex gap-3 overflow-x-auto px-4 py-1 *:shrink-0 sm:mx-0 sm:my-0 sm:gap-6 sm:overflow-visible sm:px-0 sm:py-0">
        <TermFilter
          taxonomy={FOCUS_AREA_TAXONOMY}
          allLabel={t('allFocusAreasOption')}
          ariaLabel={t('focusAreaFilterLabel')}
          value={focusAreaId}
          onChange={setFocusAreaId}
        />
        <TermFilter
          taxonomy={STRATEGY_TAXONOMY}
          allLabel={t('allStrategiesOption')}
          ariaLabel={t('strategyFilterLabel')}
          value={strategyId}
          onChange={setStrategyId}
        />
        <ResponsiveSelect<Sort>
          aria-label={t('sortLabel')}
          className="w-auto sm:w-40"
          selectedKey={sort}
          onSelectionChange={setSort}
          items={[
            { id: 'newest', label: t('sortNewest') },
            { id: 'oldest', label: t('sortOldest') },
            { id: 'name', label: t('sortName') },
          ]}
        />
      </div>

      <ErrorBoundary
        fallback={
          <p className="text-muted-foreground">{t('directoryLoadError')}</p>
        }
      >
        <Suspense fallback={<OrganizationListSkeleton />}>
          <OrganizationList
            focusAreaId={focusAreaId === ALL ? undefined : focusAreaId}
            strategyId={strategyId === ALL ? undefined : strategyId}
            sort={sort}
            initialData={isDefaultView ? initialData : undefined}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

/**
 * A single-select over one taxonomy. Organizations are tagged with leaf
 * terms, so a tree's group headings are left out of the options.
 */
const TermFilter = ({
  taxonomy,
  allLabel,
  ariaLabel,
  value,
  onChange,
}: {
  taxonomy: string;
  allLabel: string;
  ariaLabel: string;
  value: string;
  onChange: (id: string) => void;
}) => {
  const { data } = trpc.taxonomy.getTerms.useQuery({ name: taxonomy });
  const options = collectLeaves(data?.items ?? []);

  return (
    <ResponsiveSelect
      aria-label={ariaLabel}
      className="w-auto sm:w-40"
      selectedKey={value}
      onSelectionChange={onChange}
      items={[{ id: ALL, label: allLabel }, ...options]}
    />
  );
};

const OrganizationList = ({
  focusAreaId,
  strategyId,
  sort,
  initialData,
}: {
  focusAreaId?: string;
  strategyId?: string;
  sort: Sort;
  initialData?: OrganizationsPage;
}) => {
  const t = useTranslations('org');
  const [{ pages }, { fetchNextPage, hasNextPage, isFetchingNextPage }] =
    trpc.profile.list.useSuspenseInfiniteQuery(
      {
        limit: PAGE_LIMIT.md,
        types: [EntityType.ORG],
        ...SORT_INPUT[sort],
        focusAreaIds: focusAreaId ? [focusAreaId] : undefined,
        strategyIds: strategyId ? [strategyId] : undefined,
      },
      {
        getNextPageParam: nextCursor,
        initialData: initialData
          ? { pages: [initialData], pageParams: [null] }
          : undefined,
      },
    );

  const { ref, shouldShowTrigger } = useInfiniteScroll(fetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '100px',
  });

  const organizations = pages.flatMap((page) => page.items);

  if (organizations.length === 0) {
    return (
      <p aria-live="polite" className="text-muted-foreground">
        {t('directoryEmpty')}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-8">
        {organizations.map((organization) => (
          <li key={organization.id}>
            <OrganizationCard organization={organization} />
          </li>
        ))}
      </ul>
      {shouldShowTrigger && (
        <div ref={ref} className="flex justify-center">
          {isFetchingNextPage ? <OrganizationListSkeleton count={1} /> : null}
        </div>
      )}
    </>
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

const collectLeaves = (terms: TermTree): { id: string; label: string }[] =>
  terms.flatMap((term) =>
    term.children.length === 0
      ? [{ id: term.id, label: term.label }]
      : collectLeaves(term.children),
  );
