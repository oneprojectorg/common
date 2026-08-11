'use client';

import { type DecisionAccess } from '@op/api/encoders';
import {
  type ProposalReviewAggregates,
  ProposalReviewAssignmentStatus,
} from '@op/common/client';
import { Link } from '@op/ui/Link';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { useRef } from 'react';
import { useFocusable } from 'react-aria';

import { useTranslations } from '@/lib/i18n';

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
  const className =
    'shrink-0 text-base text-neutral-gray4 underline decoration-dotted underline-offset-2';

  return (
    <TooltipTrigger>
      {access?.admin ? (
        <Link href={href} variant="neutral" className={className}>
          {label}
        </Link>
      ) : (
        <FocusableSpan className={className}>{label}</FocusableSpan>
      )}
      <Tooltip>{names}</Tooltip>
    </TooltipTrigger>
  );
}

function FocusableSpan({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { focusableProps } = useFocusable({}, ref);
  return (
    <span {...focusableProps} ref={ref} tabIndex={0} className={className}>
      {children}
    </span>
  );
}
