'use client';

import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  type ReviewAssignmentExtended,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { LuEllipsis, LuFileText } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { useProposalCardData } from '../ProposalCard';
import type { ProposalSheetRoute } from '../ProposalSheet';
import { useOpenProposalInSheet } from '../ProposalSheet/proposalSheetState';
import {
  ReviewStatusBadge,
  isReviewShownOutOfDate,
} from '../ReviewStatusBadge';
import { proposalReviewsHref } from '../proposalHrefs';
import type { AssignmentStatusValue } from './assignmentStatusSpecs';

interface ReviewerAssignmentsTableProps {
  assignments: ReviewAssignmentExtended[];
  route: ProposalSheetRoute;
  /** Id of the visible heading that names the table. */
  labelledBy: string;
}

/** One reviewer's queue as a worklist; a row opens its proposal in the sheet. */
export function ReviewerAssignmentsTable({
  assignments,
  route,
  labelledBy,
}: ReviewerAssignmentsTableProps) {
  const t = useTranslations('decisions.review');

  return (
    <Table
      aria-labelledby={labelledBy}
      className="w-full [&_tbody_th]:h-15 [&_td]:h-15 [&_thead_th]:font-normal [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
    >
      <TableHeader>
        <TableRow>
          <TableHead>{t('proposalColumn')}</TableHead>
          <TableHead className="w-50">{t('statusColumn')}</TableHead>
          <TableHead className="w-38">{t('submittedColumn')}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{t('actionsColumn')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignments.map((item) => (
          <ReviewerAssignmentRow
            key={item.assignment.id}
            item={item}
            route={route}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ReviewerAssignmentRow({
  item: { assignment, review, isReviewOutOfDate },
  route,
}: {
  item: ReviewAssignmentExtended;
  route: ProposalSheetRoute;
}) {
  const t = useTranslations('decisions.review');
  const format = useFormatter();
  const openInSheet = useOpenProposalInSheet();
  const { proposal } = assignment;

  const { titleText, displayCategories, authors } = useProposalCardData({
    proposal,
  });

  // A translation record types every field as `string | string[]`.
  const title = typeof titleText === 'string' ? titleText : titleText.join(' ');
  const href = proposalReviewsHref({ ...route, profileId: proposal.profileId });
  const onOpen = openInSheet(proposal.profileId);
  const submitterName = authors?.[0]?.name;
  const submittedAt =
    review?.state === ProposalReviewState.SUBMITTED && review.submittedAt
      ? new Date(review.submittedAt)
      : null;

  return (
    // `relative` anchors the title link's stretched ::after (row-wide click).
    // `transform-gpu` is load-bearing: WebKit ignores `position: relative` on
    // a <tr> as a containing block, so without it the overlay escapes to the
    // table container in Safari and one row swallows every click.
    <TableRow className="relative transform-gpu">
      <TableRowHeader className="whitespace-normal">
        <div className="flex flex-col gap-1">
          {/* `static` keeps the row the ::after's containing block. */}
          <Link
            href={href}
            onClick={onOpen}
            className="static text-base text-foreground after:absolute after:inset-0 hover:no-underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
          >
            <bdi>{title}</bdi>
          </Link>
          {submitterName || displayCategories.length > 0 ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {submitterName ? <bdi>{submitterName}</bdi> : null}
              {displayCategories.map((category) => (
                <Badge key={category} variant="secondary">
                  <bdi>{category}</bdi>
                </Badge>
              ))}
            </span>
          ) : null}
        </div>
      </TableRowHeader>
      <TableCell>
        <ReviewStatusBadge
          status={getRowStatus({
            assignmentStatus: assignment.status,
            reviewState: review?.state,
          })}
          isOutOfDate={isReviewShownOutOfDate({
            isReviewOutOfDate,
            assignmentStatus: assignment.status,
          })}
        />
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {submittedAt
          ? format.dateTime(submittedAt, { dateStyle: 'medium' })
          : '—'}
      </TableCell>
      {/* Above the row's link overlay, so the menu button takes its own clicks. */}
      <TableCell className="relative z-10 text-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('moreActionsForProposal', { title })}
              />
            }
          >
            <LuEllipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="min-w-44">
            <DropdownMenuLinkItem
              closeOnClick
              render={<Link href={href} onClick={onOpen} />}
            >
              <LuFileText />
              {t('openProposalAction')}
            </DropdownMenuLinkItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/** A draft review survives a revision round, so the round's status wins over it. */
function getRowStatus({
  assignmentStatus,
  reviewState,
}: {
  assignmentStatus: ProposalReviewAssignmentStatus;
  reviewState: ProposalReviewState | undefined;
}): AssignmentStatusValue {
  if (
    assignmentStatus ===
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION ||
    assignmentStatus === ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW
  ) {
    return assignmentStatus;
  }

  return reviewState ?? assignmentStatus;
}
