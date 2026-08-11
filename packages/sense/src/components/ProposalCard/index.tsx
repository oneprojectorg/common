'use client';

import type { ComponentProps, ElementType, ReactNode } from 'react';
import { useId } from 'react';

/** Props the title/author link element must accept (a plain `<a>`, an i18n
 *  `Link`, a router `Link`, …). Typing `linkComponent` as `ElementType<this>`
 *  keeps the rendered element's props concrete — a bare `ElementType` infers
 *  them as `never`. */
type ProposalCardLinkProps = {
  href: string;
  className?: string;
  children?: ReactNode;
};
import type { IconType } from 'react-icons';
import { LuBookmark, LuHeart, LuMessageCircle } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { AnimatedCount } from '../AnimatedCount';
import { FacePile } from '../FacePile';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Toggle } from '../ui/toggle';

export interface ProposalCardAuthor {
  name: string;
  avatarSrc?: string;
  /** Profile link for the author label. Rendered with `linkComponent`. */
  href?: string;
}

/** A single engagement metric — a bare count, or a pressable toggle/button. */
export type ProposalCardMetric =
  | number
  | {
      count?: number;
      active?: boolean;
      onClick?: () => void;
      /** Accessible name for the metric. Translate it — the default is English. */
      label?: string;
    };

export interface ProposalCardMetrics {
  likes?: ProposalCardMetric;
  bookmarks?: ProposalCardMetric;
  comments?: ProposalCardMetric;
}

export interface ProposalCardProps extends Omit<
  ComponentProps<'div'>,
  'title' | 'children'
> {
  title: ReactNode;
  /**
   * When set, the title becomes the card's primary link and its hit area is
   * stretched over the whole card (a `::after` overlay). Menu/actions stay
   * clickable above it — the accessible "clickable card" pattern, with a
   * single real control and no nested interactive elements.
   */
  href?: string;
  /**
   * Element used to render the title (and author) links — pass an i18n / router
   * `Link` to preserve client-side navigation and locale prefixing. Defaults to
   * a plain `<a>`. Must accept `href`, `className`, and children.
   */
  linkComponent?: ElementType<ProposalCardLinkProps>;
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
  href,
  linkComponent,
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
  ...rest
}: ProposalCardProps) {
  // Points the metric controls at the title. Without it a grid of cards gives a
  // screen reader a run of identically-named "Likes: 4" toggles.
  const titleId = useId();
  const hasTags = Boolean(budget) || (tags?.length ?? 0) > 0;

  if (variant === 'pin') {
    return (
      <div
        className={cn(
          'relative flex flex-col gap-2 rounded-lg border bg-card p-3',
          className,
        )}
        {...rest}
      >
        <h3 className="line-clamp-2 font-serif text-label text-foreground">
          <TitleLink href={href} linkComponent={linkComponent}>
            {title}
          </TitleLink>
        </h3>
        {authors?.length ? (
          <AuthorRow authors={authors} linkComponent={linkComponent} compact />
        ) : null}
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
        'relative flex flex-col gap-4 rounded-lg border bg-card p-6 transition-shadow hover:shadow-md',
        selected && 'border-teal-500 bg-accent',
        className,
      )}
      {...rest}
    >
      {aside ? <div className="absolute end-6 top-6 z-10">{aside}</div> : null}
      <div className={cn('flex flex-col gap-3', aside && 'pe-10')}>
        {headerBadge}
        <h3
          id={titleId}
          className={cn(
            'font-serif text-title',
            selected ? 'text-teal-600' : 'text-foreground',
          )}
        >
          <TitleLink href={href} linkComponent={linkComponent}>
            {title}
          </TitleLink>
        </h3>
        {alert}
      </div>
      {hasBadges ? (
        <div className="flex flex-col gap-3">
          {hasTags ? (
            <TagRow budget={budget} tags={tags} maxTags={maxTags} />
          ) : null}
          {authors?.length ? (
            <AuthorRow authors={authors} linkComponent={linkComponent} />
          ) : null}
        </div>
      ) : null}
      {description ? (
        <p className="line-clamp-3 text-base text-foreground">{description}</p>
      ) : null}
      {metrics ? (
        <div className="relative z-10 flex items-center gap-1">
          <MetricToggle
            icon={LuHeart}
            metric={metrics.likes}
            label="Like"
            describedBy={titleId}
          />
          <MetricToggle
            icon={LuBookmark}
            metric={metrics.bookmarks}
            label="Follow"
            describedBy={titleId}
          />
          <MetricButton
            icon={LuMessageCircle}
            metric={metrics.comments}
            label="Comments"
            describedBy={titleId}
          />
        </div>
      ) : null}
      {hasStatusRow ? (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            {status}
            {/* `relative z-10` lifts the label above the title's stretched
                link overlay so an interactive `reviewedLabel` (e.g. a
                reviewers tooltip trigger) stays hoverable/clickable. */}
            <span className="relative z-10 text-sm text-muted-foreground">
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
        // Equal-width actions in a row — each top-level action fills its share.
        <div className="relative z-10 flex items-center gap-3 [&>*]:flex-1">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Title content — a stretched primary link when `href` is set, else plain. */
function TitleLink({
  href,
  linkComponent: Link = 'a',
  children,
}: {
  href?: string;
  linkComponent?: ElementType<ProposalCardLinkProps>;
  children: ReactNode;
}) {
  if (!href) {
    return <>{children}</>;
  }
  return (
    <Link
      href={href}
      className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
    >
      {children}
    </Link>
  );
}

function AuthorRow({
  authors,
  linkComponent: Link = 'a',
  compact,
}: {
  authors: ProposalCardAuthor[];
  linkComponent?: ElementType<ProposalCardLinkProps>;
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
      {first?.href ? (
        // `relative z-10` lifts the author link above the title's stretched
        // overlay so it stays independently clickable (clickable-card pattern).
        <Link
          href={first.href}
          className="relative z-10 w-fit rounded-sm text-sm text-muted-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {label}
        </Link>
      ) : (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
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
      {budget ? (
        <Badge variant="outline" className="bg-background">
          {budget}
        </Badge>
      ) : null}
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

const METRIC_CLASS = 'gap-1 px-2 font-normal text-muted-foreground';

/**
 * Icon, name, count — the accessible name of every metric, interactive or not.
 *
 * The name is rendered rather than set with `aria-label` so it includes the
 * count: `aria-label` would replace the content, and a toggle announced as just
 * "Like" leaves a screen reader with no read on the number that moved.
 */
function MetricContent({
  icon: Icon,
  count,
  label,
  active,
}: {
  icon: IconType;
  count?: number;
  label: string;
  active?: boolean;
}) {
  return (
    <>
      <Icon className={cn('size-4', active && 'fill-current')} aria-hidden />
      <span className="sr-only">{label}: </span>
      <AnimatedCount value={count ?? 0} />
    </>
  );
}

/** Non-interactive count (no handler) — matches the app's display-only chips. */
function MetricDisplay({
  icon,
  count,
  label,
}: {
  icon: IconType;
  count?: number;
  label: string;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1 px-2 text-sm text-muted-foreground">
      <MetricContent icon={icon} count={count} label={label} />
    </span>
  );
}

/** Like / Follow — a pressable Toggle when interactive, else a static count. */
function MetricToggle({
  icon,
  metric,
  label,
  describedBy,
}: {
  icon: IconType;
  metric?: ProposalCardMetric;
  label: string;
  /** Id of the card title, so the control says which proposal it acts on. */
  describedBy?: string;
}) {
  if (metric == null) {
    return null;
  }
  const {
    count,
    active,
    onClick,
    label: metricLabel = label,
  } = metricParts(metric);
  if (!onClick) {
    return <MetricDisplay icon={icon} count={count} label={metricLabel} />;
  }
  return (
    <Toggle
      size="sm"
      pressed={active}
      onPressedChange={() => onClick()}
      aria-describedby={describedBy}
      className={METRIC_CLASS}
    >
      <MetricContent
        icon={icon}
        count={count}
        label={metricLabel}
        active={active}
      />
    </Toggle>
  );
}

/** Comment — a Button when interactive, else a static count. */
function MetricButton({
  icon,
  metric,
  label,
  describedBy,
}: {
  icon: IconType;
  metric?: ProposalCardMetric;
  label: string;
  /** Id of the card title, so the control says which proposal it acts on. */
  describedBy?: string;
}) {
  if (metric == null) {
    return null;
  }
  const { count, onClick, label: metricLabel = label } = metricParts(metric);
  if (!onClick) {
    return <MetricDisplay icon={icon} count={count} label={metricLabel} />;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-describedby={describedBy}
      className={METRIC_CLASS}
    >
      <MetricContent icon={icon} count={count} label={metricLabel} />
    </Button>
  );
}
