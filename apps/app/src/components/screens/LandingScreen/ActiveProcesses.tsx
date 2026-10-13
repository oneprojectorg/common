'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { type DecisionProfile, ProcessStatus } from '@op/api/encoders';
import { PAGE_LIMIT, nextCursor } from '@op/common/client';
import { getTextPreview } from '@op/core';
import { Button } from '@op/sense/Button';
import { Header2, Header3 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Skeleton } from '@op/sense/Skeleton';
import Image from 'next/image';
import { Suspense, useState } from 'react';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';
import ErrorBoundary from '@/components/ErrorBoundary';

/** How many processes show before "See more" expands the list in place. */
const MAX_HOME_PROCESSES = 3;

const ACTIVE_PROCESSES_LIST_ID = 'home-active-processes';

/**
 * The published processes the user belongs to, as cover-image cards
 * (Figma 21477:62866). Hidden entirely when there are none.
 */
export const ActiveProcesses = () => {
  return (
    <ErrorBoundary fallback={<></>}>
      <Suspense fallback={<ActiveProcessesSkeleton />}>
        <ActiveProcessesList />
      </Suspense>
    </ErrorBoundary>
  );
};

const ActiveProcessesList = () => {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);

  // Same query and input as the sidebar's Active Decisions group, so both
  // read one cache entry and page together.
  const [{ pages }, { hasNextPage, fetchNextPage, isFetchingNextPage }] =
    trpc.decision.listDecisionProfiles.useSuspenseInfiniteQuery(
      { status: [ProcessStatus.PUBLISHED], limit: PAGE_LIMIT.sm },
      { getNextPageParam: nextCursor },
    );
  const decisions = pages.flatMap((page) => page.items);

  if (decisions.length === 0) {
    return null;
  }

  const visible = isExpanded
    ? decisions
    : decisions.slice(0, MAX_HOME_PROCESSES);
  // Collapsed: more if anything is hidden. Expanded: more if the server has
  // another page.
  const canSeeMore = isExpanded
    ? hasNextPage
    : decisions.length > MAX_HOME_PROCESSES || hasNextPage;

  const seeMore = () => {
    if (isExpanded || decisions.length <= MAX_HOME_PROCESSES) {
      fetchNextPage();
    }
    setIsExpanded(true);
  };

  return (
    <section className="flex flex-col gap-4">
      <Header2 className="text-label font-normal">
        {t('shell.activeProcessesHeading')}
      </Header2>
      <ul id={ACTIVE_PROCESSES_LIST_ID} className="flex flex-col gap-4">
        {visible.map((decision) => (
          <li key={decision.id}>
            <ProcessCard decision={decision} />
          </li>
        ))}
      </ul>
      {canSeeMore && (
        <Button
          variant="secondary"
          className="self-center"
          onClick={seeMore}
          loading={isFetchingNextPage}
          aria-expanded={false}
          aria-controls={ACTIVE_PROCESSES_LIST_ID}
        >
          {t('shell.seeMoreAction')}
          <LuChevronDown />
        </Button>
      )}
      {isExpanded && !canSeeMore && (
        <Button
          variant="secondary"
          className="self-center"
          onClick={() => setIsExpanded(false)}
          aria-expanded
          aria-controls={ACTIVE_PROCESSES_LIST_ID}
        >
          {t('shell.seeLessAction')}
          <LuChevronUp />
        </Button>
      )}
    </section>
  );
};

const ProcessCard = ({ decision }: { decision: DecisionProfile }) => {
  const t = useTranslations();
  const instance = decision.processInstance;
  const coverUrl = getPublicUrl(instance.instanceData?.overview?.heroImage);
  const host = instance.steward ?? instance.owner;
  const description =
    instance.instanceData?.overview?.description ||
    (instance.description
      ? getTextPreview({ content: instance.description })
      : undefined);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-background sm:flex-row">
      <div className="relative h-32 shrink-0 bg-coralCoral sm:h-auto sm:w-52">
        {coverUrl && (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 13rem, 100vw"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Header3>{decision.name}</Header3>
          {host ? (
            <div className="flex items-center gap-2">
              <ProfileAvatar
                name={host.name}
                src={getPublicUrl(host.avatarImage?.name)}
                alt=""
                size="sm"
              />
              <bdi className="text-sm text-muted-foreground">{host.name}</bdi>
            </div>
          ) : null}
          {description ? (
            <p dir="auto" className="truncate ltr:text-left rtl:text-right">
              {description}
            </p>
          ) : null}
        </div>
        <ButtonLink
          href={`/decisions/${decision.slug}`}
          className="shrink-0"
          aria-label={t('shell.participateInProcessLabel', {
            name: decision.name,
          })}
        >
          {t('decisions.participateAction')}
        </ButtonLink>
      </div>
    </article>
  );
};

const ActiveProcessesSkeleton = () => (
  <div className="flex flex-col gap-4">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-36 w-full rounded-xl" />
    <Skeleton className="h-36 w-full rounded-xl" />
  </div>
);
