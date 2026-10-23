'use client';

import { getPublicUrl } from '@/utils';
import {
  type Proposal,
  type ProposalReviewAggregates,
  ProposalReviewAssignmentStatus,
} from '@op/common/client';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { FacePile } from '@op/sense/FacePile';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { Progress } from '@op/sense/Progress';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import type { ReactNode } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { usesDistrictLabels } from './CategoryFilterSelect';
import {
  ProposalStatusBadge,
  useProposalCardData,
} from './ProposalCard/ProposalCardView';
import { useProposalReviewAggregates } from './proposalReviewDecoration';

type Reviewer = ProposalReviewAggregates['reviewers'][number];

interface ProposalReviewProgressTableProps {
  proposals: Proposal[];
  /** Decision profile slug — builds each row's reviews link. */
  decisionSlug: string;
  /** Shown instead of the table when the filter matches nothing. */
  emptyState: ReactNode;
}

/** Faces shown before the "+N" bubble. */
const MAX_FACES = 3;

/**
 * The admin's review progress per proposal: who reviews it and how many
 * reviews are in. Each row opens the proposal's reviews screen. The review data
 * comes from the enclosing `ProposalReviewDecorationProvider`, which fetches
 * the aggregates for the proposals the list has loaded.
 */
export function ProposalReviewProgressTable({
  proposals,
  decisionSlug,
  emptyState,
}: ProposalReviewProgressTableProps) {
  const t = useTranslations('decisions');

  if (proposals.length === 0) {
    return emptyState;
  }

  return (
    <Table
      aria-label={t('allProposalsTab')}
      className="w-full [&_tbody_th]:px-5 [&_tbody_th]:py-3 [&_td]:px-5 [&_td]:py-3 [&_th]:px-5 [&_thead_th]:font-normal [&_tr>*:first-child]:ps-3 [&_tr>*:last-child]:pe-3"
    >
      <TableHeader>
        <TableRow>
          <TableHead>{t('review.proposalColumn')}</TableHead>
          <TableHead className="w-40">
            {usesDistrictLabels(decisionSlug)
              ? t('review.districtColumn')
              : t('review.categoryColumn')}
          </TableHead>
          <TableHead className="w-36">{t('review.reviewersHeading')}</TableHead>
          <TableHead className="w-56">{t('review.reviewsLabel')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((proposal) => (
          <ProposalReviewProgressRow
            key={proposal.id}
            proposal={proposal}
            href={`/decisions/${decisionSlug}/proposal/${proposal.profileId}/reviews`}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ProposalReviewProgressRow({
  proposal,
  href,
}: {
  proposal: Proposal;
  href: string;
}) {
  const { titleText, displayCategories } = useProposalCardData({ proposal });
  const aggregates = useProposalReviewAggregates(proposal.id);
  const submitterName = proposal.submittedBy
    ? proposal.submittedBy.name || proposal.submittedBy.slug
    : undefined;

  return (
    // `relative` anchors the title link's stretched ::after (row-wide click).
    // `transform-gpu` is load-bearing: WebKit ignores `position: relative` on a
    // <tr> as a containing block, so without it the overlay escapes to the
    // table container in Safari and one row swallows every click.
    <TableRow className="relative transform-gpu">
      <TableRowHeader className="whitespace-normal">
        <div className="flex flex-col gap-1">
          {/* `static` keeps the row the ::after's containing block. */}
          <Link
            href={href}
            className="static text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
          >
            <bdi>{titleText}</bdi>
          </Link>
          {/* The category has its own column; the card's status badge goes here. */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {submitterName ? <bdi>{submitterName}</bdi> : null}
            {/* One step down from the card's 36px pill so it doesn't set the row height. */}
            <ProposalStatusBadge
              proposal={proposal}
              className="h-7 px-1.5 py-1 text-xs [&>[data-slot=status-badge-icon]]:size-3.5"
            />
          </div>
        </div>
      </TableRowHeader>
      <TableCell className="whitespace-normal">
        {displayCategories.length > 0 ? (
          <bdi>{displayCategories.join(', ')}</bdi>
        ) : (
          <EmptyMark />
        )}
      </TableCell>
      <TableCell>
        {aggregates ? (
          <ReviewersPile reviewers={aggregates.reviewers} />
        ) : (
          <Skeleton className="h-6 w-20" />
        )}
      </TableCell>
      <TableCell>
        {aggregates ? (
          <ReviewsMeter aggregates={aggregates} />
        ) : (
          <Skeleton className="h-5 w-36" />
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * The assigned reviewers, submitted ones first and in full, pending ones
 * faded. The tooltip and the accessible name list each reviewer's state.
 */
function ReviewersPile({ reviewers }: { reviewers: Reviewer[] }) {
  const t = useTranslations('decisions.review');

  if (reviewers.length === 0) {
    return <EmptyMark label={t('noAssignments')} />;
  }

  const isSubmitted = (reviewer: Reviewer) =>
    reviewer.status === ProposalReviewAssignmentStatus.COMPLETED;
  const ordered = [
    ...reviewers.filter(isSubmitted),
    ...reviewers.filter((reviewer) => !isSubmitted(reviewer)),
  ];

  const stateFor = (reviewer: Reviewer) => {
    const key = getReviewerStateKey(reviewer);

    return {
      label: t.markup(key, {
        name: reviewer.profile.name,
        bdi: (chunks) => chunks,
      }),
      line: t.rich(key, {
        name: reviewer.profile.name,
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      }),
    };
  };
  const states = ordered.map(stateFor);

  const faces = ordered
    .slice(0, MAX_FACES)
    .map((reviewer) => (
      <ProfileAvatar
        key={reviewer.profile.id}
        size="sm"
        name={reviewer.profile.name}
        alt={reviewer.profile.name}
        src={
          reviewer.profile.avatarImage?.name
            ? getPublicUrl(reviewer.profile.avatarImage.name)
            : undefined
        }
        className={isSubmitted(reviewer) ? undefined : 'opacity-50 grayscale'}
      />
    ));
  const overflow = ordered.length - MAX_FACES;

  if (overflow > 0) {
    faces.push(
      <Avatar key="overflow" size="sm">
        <AvatarFallback className="bg-foreground text-background">
          +{overflow}
        </AvatarFallback>
      </Avatar>,
    );
  }

  return (
    // The root layout provides the tooltip group and delay.
    <Tooltip>
      <TooltipTrigger
        render={
          // `role="img"` names the pile as one thing and keeps the faces
          // inside it from being read one by one. z-10 lifts it above the
          // row's stretched link so it can be hovered and focused.
          <div
            role="img"
            tabIndex={0}
            aria-label={states.map((state) => state.label).join(', ')}
            className="relative z-10 w-fit rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <FacePile items={faces} className="justify-start" />
      </TooltipTrigger>
      <TooltipContent className="text-sm">
        <ul>
          {states.map((state, index) => (
            <li key={ordered[index]?.profile.id ?? index}>{state.line}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/** "Submitted of assigned" as a meter, flagged when a review is out of date. */
function ReviewsMeter({
  aggregates,
}: {
  aggregates: ProposalReviewAggregates;
}) {
  const t = useTranslations('decisions.review');
  const {
    assignmentsCount: assigned,
    reviewsSubmittedCount: submitted,
    outOfDateReviewsCount: outOfDate,
  } = aggregates;

  if (assigned === 0) {
    return <EmptyMark label={t('noAssignments')} />;
  }

  const outOfDateLabel = t('reviewsOutOfDateShort', {
    n: outOfDate,
    total: submitted,
  });

  return (
    <span className="flex items-center gap-2.5">
      <Progress
        value={(submitted / assigned) * 100}
        className="w-24"
        aria-label={t('reviewProgressLabel')}
      />
      <span className="text-sm whitespace-nowrap tabular-nums">
        {t('submittedOfAssignedShort', { submitted, assigned })}
      </span>
      {outOfDate > 0 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                role="img"
                tabIndex={0}
                aria-label={outOfDateLabel}
                className="relative z-10 inline-flex rounded-full text-warning outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            <LuCircleAlert className="size-4" aria-hidden />
          </TooltipTrigger>
          <TooltipContent className="text-sm">{outOfDateLabel}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

/** A dash for an empty cell; `label` is what a screen reader hears instead. */
function EmptyMark({ label }: { label?: string }) {
  return (
    <>
      <span aria-hidden className="text-muted-foreground">
        —
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}

/** Pending reads as not started; every other open state as in progress. */
function getReviewerStateKey(reviewer: Reviewer) {
  switch (reviewer.status) {
    case ProposalReviewAssignmentStatus.COMPLETED:
      return 'reviewerSubmittedState';
    case ProposalReviewAssignmentStatus.PENDING:
      return 'reviewerNotStartedState';
    default:
      return 'reviewerInProgressState';
  }
}
