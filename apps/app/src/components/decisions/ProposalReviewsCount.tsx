'use client';

import { type DecisionAccess } from '@op/api/encoders';
import {
  type ProposalReviewAggregates,
  ProposalReviewAssignmentStatus,
} from '@op/common/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';

import { Link, useTranslations } from '@/lib/i18n';

type Reviewers = ProposalReviewAggregates['reviewers'];

/**
 * The reviewers a proposal's count speaks for: those whose assignment is
 * completed. The one definition of "reviewed" behind both this label and the
 * decision to show it at all, so the two can never disagree about whether there
 * is anything to report.
 */
export const getCompletedReviewers = (reviewers: Reviewers): Reviewers =>
  reviewers.filter(
    (reviewer) => reviewer.status === ProposalReviewAssignmentStatus.COMPLETED,
  );

interface ProposalReviewsCountProps {
  reviewers: Reviewers;
  /** Review summary route for the proposal. */
  href: string;
  access?: DecisionAccess;
  /**
   * Which copy the count carries:
   *   - `reviews` (default): "{count} Reviews", and nothing at all at zero —
   *     the reviewer-facing label, where an empty count is just noise.
   *   - `reviewed`: "{count} Reviewed", rendered at zero too — the admin
   *     progress label, where "0 Reviewed" is exactly the signal being tracked.
   */
  variant?: 'reviews' | 'reviewed';
}

/**
 * Submitted-review count for a proposal, with the reviewer names in a tooltip.
 * Links to the review summary for admins; plain text for everyone else.
 */
export function ProposalReviewsCount({
  reviewers,
  href,
  access,
  variant = 'reviews',
}: ProposalReviewsCountProps) {
  const t = useTranslations();

  const completedReviewers = getCompletedReviewers(reviewers);
  const count = completedReviewers.length;

  if (count === 0 && variant === 'reviews') {
    return null;
  }

  const label =
    variant === 'reviewed'
      ? t('{count} Reviewed', { count })
      : t('{count} Reviews', { count });
  // Dotted underline reads as "explicable", not "navigable" — the tooltip is
  // the payload for everyone, and admins additionally get a real link. The ring
  // is the sense focus treatment, replacing react-aria's useFocusable.
  const className =
    'shrink-0 rounded-sm text-base text-muted-foreground underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

  // Nobody has finished, so there are no names to explain: drop the tooltip
  // (and the underline that promises one) rather than open an empty popup. The
  // admin link stays — "0 Reviewed" is still a way into the progress screen.
  if (count === 0) {
    return access?.admin ? (
      <Link href={href} className={className}>
        {label}
      </Link>
    ) : (
      <span className="shrink-0 text-base text-muted-foreground">{label}</span>
    );
  }

  const names = completedReviewers
    .map((reviewer) => reviewer.profile.name)
    .join(', ');

  return (
    // The root layout provides the tooltip group and delay.
    <Tooltip>
      <TooltipTrigger
        render={
          // No aria-label: the visible "{count} Reviews" text is the accessible
          // name, and base-ui exposes the names popup as the description. The
          // non-admin span still takes focus so keyboard users reach the names.
          access?.admin ? (
            <Link href={href} className={className} />
          ) : (
            <span tabIndex={0} className={className} />
          )
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent className="text-sm">{names}</TooltipContent>
    </Tooltip>
  );
}
