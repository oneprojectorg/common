'use client';

import { type DecisionAccess } from '@op/api/encoders';
import {
  type ProposalReviewAggregates,
  ProposalReviewAssignmentStatus,
} from '@op/common/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';

import { Link, useTranslations } from '@/lib/i18n';

type Reviewers = ProposalReviewAggregates['reviewers'];

interface ProposalReviewsCountProps {
  reviewers: Reviewers;
  /** Review summary route for the proposal. */
  href: string;
  access?: DecisionAccess;
}

/**
 * Submitted-review count for a proposal, with the reviewer names in a tooltip.
 * Links to the review summary for admins; plain text for everyone else.
 */
export function ProposalReviewsCount({
  reviewers,
  href,
  access,
}: ProposalReviewsCountProps) {
  const t = useTranslations();

  const completedReviewers = reviewers.filter(
    (reviewer) => reviewer.status === ProposalReviewAssignmentStatus.COMPLETED,
  );

  if (completedReviewers.length === 0) {
    return null;
  }

  const names = completedReviewers
    .map((reviewer) => reviewer.profile.name)
    .join(', ');
  const label = t('{count} Reviews', { count: completedReviewers.length });
  // Dotted underline reads as "explicable", not "navigable" — the tooltip is
  // the payload for everyone, and admins additionally get a real link. The ring
  // is the sense focus treatment, replacing react-aria's useFocusable.
  const className =
    'shrink-0 rounded-sm text-base text-muted-foreground underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

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
