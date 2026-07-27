'use client';

import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { LuBookmark, LuHeart, LuMessageCircle } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { FacePile } from '../FacePile';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Toggle } from '../ui/toggle';

export interface ProposalCardAuthor {
  name: string;
  avatarSrc?: string;
}

/** A single engagement metric — a bare count, or a pressable toggle/button. */
export type ProposalCardMetric =
  | number
  | { count?: number; active?: boolean; onClick?: () => void; label?: string };

export interface ProposalCardMetrics {
  likes?: ProposalCardMetric;
  bookmarks?: ProposalCardMetric;
  comments?: ProposalCardMetric;
}

export interface ProposalCardProps {
  title: ReactNode;
  /** Visibility/status badge above the title (e.g. Draft, Hidden, Flagged). */
  headerBadge?: ReactNode;
  /** Alert below the title — typically a `StatusBadge` (e.g. "Revision requested"). */
  alert?: ReactNode;
  /** Utility-corner slot (absolute top-right) — an "…" menu or select toggle. */
  aside?: ReactNode;
  /** Selected treatment (teal border + title) for vote/selection phases. */
  selected?: boolean;
  /** Formatted budget, e.g. "$145,000". Rendered as the leading tag. */
  budget?: ReactNode;
  /** Category tags; anything past `maxTags` collapses into a "+N" chip. */
  tags?: string[];
  maxTags?: number;
  /** One or more authors — rendered as a facepile with a "Name +N" label. */
  authors?: ProposalCardAuthor[];
  description?: ReactNode;
  metrics?: ProposalCardMetrics;
  /** Left side of the status row — typically a `StatusBadge`. */
  status?: ReactNode;
  /** Right side of the status row (e.g. "5 Reviewed"). */
  reviewedLabel?: ReactNode;
  totalVotes?: number;
  totalVotesLabel?: string;
  /** Right of the votes row when funded — typically a success `StatusBadge`. */
  awardedLabel?: ReactNode;
  /** Action row — e.g. Revise / Edit / Delete buttons. */
  actions?: ReactNode;
  /** Compact map-pin variant: title + author + tags only. */
  variant?: 'default' | 'pin';
  className?: string;
}

/**
 * Presentational proposal card, covering the decision phases (submission,
 * review, vote, selection, results). Holds no data or mutations — the caller
 * passes formatted values, supplies the action buttons via `actions`, and the
 * top-right control (menu / select toggle) via `aside`. The `pin` variant is
 * the compact form used inside map hovercards. Hover lift is CSS-only.
 */
export function ProposalCard({
  title,
  headerBadge,
  alert,
  aside,
  selected = false,
  budget,
  tags,
  maxTags = 3,
  authors,
  description,
  metrics,
  status,
  reviewedLabel,
  totalVotes,
  totalVotesLabel = 'Total Votes',
  awardedLabel,
  actions,
  variant = 'default',
  className,
}: ProposalCardProps) {
  const hasTags = Boolean(budget) || (tags?.length ?? 0) > 0;

  if (variant === 'pin') {
    return (
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border bg-card p-3',
          className,
        )}
      >
        <h3 className="line-clamp-2 font-serif text-title-sm text-foreground">
          {title}
        </h3>
        {authors?.length ? <AuthorRow authors={authors} compact /> : null}
        {hasTags ? (
          <TagRow budget={budget} tags={tags} maxTags={maxTags} />
        ) : null}
      </div>
    );
  }

  const hasBadges = hasTags || (authors?.length ?? 0) > 0;
  const hasStatusRow = Boolean(status) || Boolean(reviewedLabel);
  const hasVotesRow = totalVotes != null || Boolean(awardedLabel);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-card p-6 transition-shadow hover:shadow-md',
        selected && 'border-teal-500 bg-accent',
        className,
      )}
    >
      <div className={cn('relative flex flex-col gap-3', aside && 'pe-10')}>
        {headerBadge}
        <h3
          className={cn(
            'font-serif text-title-sm',
            selected ? 'text-teal-600' : 'text-foreground',
          )}
        >
          {title}
        </h3>
        {alert}
        {aside ? <div className="absolute end-0 top-0">{aside}</div> : null}
      </div>
      {hasBadges ? (
        <div className="flex flex-col gap-3">
          {hasTags ? (
            <TagRow budget={budget} tags={tags} maxTags={maxTags} />
          ) : null}
          {authors?.length ? <AuthorRow authors={authors} /> : null}
        </div>
      ) : null}
      {description ? (
        <p className="line-clamp-3 text-base text-foreground">{description}</p>
      ) : null}
      {metrics ? (
        <div className="-ms-2 flex items-center gap-1">
          <MetricToggle icon={LuHeart} metric={metrics.likes} label="Like" />
          <MetricToggle
            icon={LuBookmark}
            metric={metrics.bookmarks}
            label="Follow"
          />
          <MetricButton
            icon={LuMessageCircle}
            metric={metrics.comments}
            label="Comments"
          />
        </div>
      ) : null}
      {hasStatusRow ? (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            {status}
            <span className="text-sm text-muted-foreground">
              {reviewedLabel}
            </span>
          </div>
        </>
      ) : null}
      {hasVotesRow || actions ? <Separator /> : null}
      {hasVotesRow ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-muted-foreground">
            <span className="text-foreground">{totalVotes}</span>{' '}
            {totalVotesLabel}
          </span>
          {awardedLabel}
        </div>
      ) : null}
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}

function AuthorRow({
  authors,
  compact,
}: {
  authors: ProposalCardAuthor[];
  compact?: boolean;
}) {
  const first = authors[0];
  const label =
    authors.length > 1 ? `${first?.name} +${authors.length - 1}` : first?.name;
  return (
    <div className="flex items-center gap-1.5">
      <FacePile
        items={authors.map((author, index) => (
          <Avatar
            key={index}
            className={cn(
              compact ? 'size-4' : 'size-6',
              'ring-2 ring-background',
            )}
          >
            {author.avatarSrc ? (
              <AvatarImage src={author.avatarSrc} alt="" />
            ) : null}
            <AvatarFallback name={author.name} />
          </Avatar>
        ))}
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function TagRow({
  budget,
  tags = [],
  maxTags,
}: {
  budget?: ReactNode;
  tags?: string[];
  maxTags: number;
}) {
  const shown = tags.slice(0, maxTags);
  const overflow = tags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {budget ? <Badge variant="secondary">{budget}</Badge> : null}
      {shown.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
      {overflow > 0 ? (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      ) : null}
    </div>
  );
}

function metricParts(metric: ProposalCardMetric) {
  return typeof metric === 'number' ? { count: metric } : metric;
}

/** Like / Follow — a pressable Toggle that reflects the active state. */
function MetricToggle({
  icon: Icon,
  metric,
  label,
}: {
  icon: IconType;
  metric?: ProposalCardMetric;
  label: string;
}) {
  if (metric == null) {
    return null;
  }
  const { count, active, onClick } = metricParts(metric);
  return (
    <Toggle
      size="sm"
      pressed={active}
      onPressedChange={onClick ? () => onClick() : undefined}
      aria-label={label}
      className="gap-1 px-2 font-normal text-muted-foreground"
    >
      <Icon className="size-4" aria-hidden />
      {count ?? 0}
    </Toggle>
  );
}

/** Comment — a plain Button that opens the thread. */
function MetricButton({
  icon: Icon,
  metric,
  label,
}: {
  icon: IconType;
  metric?: ProposalCardMetric;
  label: string;
}) {
  if (metric == null) {
    return null;
  }
  const { count, onClick } = metricParts(metric);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={label}
      className="gap-1 px-2 font-normal text-muted-foreground"
    >
      <Icon className="size-4" aria-hidden />
      {count ?? 0}
    </Button>
  );
}
