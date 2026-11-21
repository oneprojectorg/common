'use client';

import type { ReviewAssignmentExtended } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@op/sense/Item';
import { LuEllipsis, LuFileText } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import type { ProposalSheetRoute } from '../ProposalSheet/proposalSheetState';
import { ReviewStatusBadge } from '../ReviewStatusBadge';
import { useAssignmentRow } from './ReviewerAssignmentsTable';

interface ReviewerAssignmentListProps {
  assignments: ReviewAssignmentExtended[];
  route: ProposalSheetRoute;
  /** Id of the visible heading that names the list. */
  labelledBy: string;
}

/** One reviewer's queue as cards, for the narrow reviewer panel. */
export function ReviewerAssignmentList({
  assignments,
  route,
  labelledBy,
}: ReviewerAssignmentListProps) {
  return (
    <ItemGroup aria-labelledby={labelledBy} className="gap-2">
      {assignments.map((item) => (
        <ReviewerAssignmentItem
          key={item.assignment.id}
          item={item}
          route={route}
        />
      ))}
    </ItemGroup>
  );
}

function ReviewerAssignmentItem({
  item,
  route,
}: {
  item: ReviewAssignmentExtended;
  route: ProposalSheetRoute;
}) {
  const t = useTranslations('decisions.review');
  const {
    title,
    href,
    onOpen,
    submitterName,
    displayCategories,
    status,
    isOutOfDate,
  } = useAssignmentRow({ item, route });

  return (
    // `relative` anchors the title link's stretched ::after (card-wide click).
    <Item
      role="listitem"
      variant="outline"
      className="relative min-h-19 flex-nowrap gap-3 hover:bg-muted"
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full font-normal">
          {/* `static` keeps the card the ::after's containing block. */}
          <Link
            href={href}
            onClick={onOpen}
            dir="auto"
            className="static min-w-0 truncate text-foreground after:absolute after:inset-0 after:rounded-lg hover:no-underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50 ltr:text-left rtl:text-right"
          >
            {title}
          </Link>
        </ItemTitle>
        {submitterName || displayCategories.length > 0 ? (
          <ItemDescription className="flex flex-wrap items-center gap-1 text-sm">
            {submitterName ? <bdi>{submitterName}</bdi> : null}
            {displayCategories.map((category) => (
              <Badge key={category} variant="secondary">
                <bdi>{category}</bdi>
              </Badge>
            ))}
          </ItemDescription>
        ) : null}
      </ItemContent>
      {/* Above the card's link overlay, so the menu takes its own clicks. */}
      <ItemActions className="relative z-10 shrink-0 gap-3">
        <ReviewStatusBadge status={status} isOutOfDate={isOutOfDate} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="-me-2"
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
      </ItemActions>
    </Item>
  );
}
