'use client';

import { getPublicUrl } from '@/utils';
import {
  type Proposal,
  type ProposalReviewAggregates,
  ProposalReviewAssignmentStatus,
} from '@op/common/client';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
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
import { useFormatter } from 'next-intl';
import { LuCircleAlert } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import {
  ProposalStatusBadge,
  useProposalCardData,
} from './ProposalCard/ProposalCardView';
import { useProposalReviewAggregates } from './proposalReviewDecoration';

type Reviewer = ProposalReviewAggregates['reviewers'][number];

interface ProposalReviewProgressTableProps {
  proposals: Proposal[];
  decisionSlug: string;
}

const MAX_FACES = 3;

export function ProposalReviewProgressTable({
  proposals,
  decisionSlug,
}: ProposalReviewProgressTableProps) {
  const t = useTranslations('decisions');

  return (
    <Table
      aria-label={t('allProposalsTab')}
      className="w-full [&_tbody_th]:h-15 [&_td]:h-15 [&_thead_th]:font-normal [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
    >
      <TableHeader>
        <TableRow>
          <TableHead>{t('review.proposalColumn')}</TableHead>
          <TableHead className="w-30">{t('review.reviewersHeading')}</TableHead>
          <TableHead className="w-45">{t('review.reviewsLabel')}</TableHead>
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
  const review = useProposalReviewAggregates(proposal.id);
  const submitterName = proposal.submittedBy
    ? proposal.submittedBy.name || proposal.submittedBy.slug
    : undefined;

  return (
    // `transform-gpu` is load-bearing: WebKit ignores `position: relative` on
    // a <tr>, so without it the link's ::after overlay covers the whole table.
    <TableRow className="relative transform-gpu">
      <TableRowHeader className="whitespace-normal">
        <div className="flex flex-col gap-1">
          <Link
            href={href}
            className="static text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
          >
            <bdi>{titleText}</bdi>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {submitterName ? <bdi>{submitterName}</bdi> : null}
            {displayCategories.map((category) => (
              <Badge key={category} variant="secondary">
                <bdi>{category}</bdi>
              </Badge>
            ))}
            <ProposalStatusBadge
              proposal={proposal}
              className="h-7 px-1.5 py-1 text-xs [&>[data-slot=status-badge-icon]]:size-3.5"
            />
          </div>
        </div>
      </TableRowHeader>
      <TableCell>
        {review.status === 'ready' ? (
          <ReviewersPile reviewers={review.aggregates.reviewers} />
        ) : (
          <PendingReviewCell status={review.status} className="h-6 w-20" />
        )}
      </TableCell>
      <TableCell>
        {review.status === 'ready' ? (
          <ReviewsMeter aggregates={review.aggregates} />
        ) : (
          <PendingReviewCell status={review.status} className="h-5 w-36" />
        )}
      </TableCell>
    </TableRow>
  );
}

function ReviewersPile({ reviewers }: { reviewers: Reviewer[] }) {
  const t = useTranslations('decisions.review');
  const format = useFormatter();

  if (reviewers.length === 0) {
    return <EmptyMark label={t('noAssignments')} />;
  }

  const ordered = [
    ...reviewers.filter(isSubmitted),
    ...reviewers.filter((reviewer) => !isSubmitted(reviewer)),
  ];

  const stateFor = (reviewer: Reviewer) => {
    const name = reviewer.profile.name;

    if (isSubmitted(reviewer)) {
      const key = reviewer.isOutOfDate
        ? 'reviewerSubmittedOutOfDateState'
        : 'reviewerSubmittedState';
      const date = reviewer.submittedAt
        ? format.dateTime(new Date(reviewer.submittedAt), {
            month: 'short',
            day: 'numeric',
          })
        : '';

      return {
        id: reviewer.profile.id,
        label: t.markup(key, { name, date, bdi: (chunks) => chunks }),
        line: t.rich(key, {
          name,
          date,
          bdi: (chunks) => <bdi>{chunks}</bdi>,
        }),
      };
    }

    const key =
      reviewer.status === ProposalReviewAssignmentStatus.PENDING
        ? 'reviewerNotStartedState'
        : 'reviewerInProgressState';

    return {
      id: reviewer.profile.id,
      label: t.markup(key, { name, bdi: (chunks) => chunks }),
      line: t.rich(key, { name, bdi: (chunks) => <bdi>{chunks}</bdi> }),
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
    <Tooltip>
      <TooltipTrigger
        render={
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
          {states.map((state) => (
            <li key={state.id}>{state.line}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

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

function PendingReviewCell({
  status,
  className,
}: {
  status: 'loading' | 'unavailable';
  className: string;
}) {
  const t = useTranslations('decisions.review');

  if (status === 'loading') {
    return <Skeleton className={className} />;
  }

  return <EmptyMark label={t('reviewProgressUnavailable')} />;
}

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

function isSubmitted(reviewer: Reviewer) {
  return reviewer.status === ProposalReviewAssignmentStatus.COMPLETED;
}
