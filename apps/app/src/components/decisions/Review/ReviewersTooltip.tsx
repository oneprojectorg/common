import {
  ProposalReviewAssignmentStatus,
  type ProposalReviewAggregates,
} from '@op/common/client';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { useRef } from 'react';
import { useFocusable } from 'react-aria';

import { useTranslations } from '@/lib/i18n';

type Reviewers = ProposalReviewAggregates['reviewers'];

export function ReviewersTooltip({ reviewers }: { reviewers: Reviewers }) {
  const t = useTranslations();

  const completedReviewers = reviewers.filter(
    (r) => r.status === ProposalReviewAssignmentStatus.COMPLETED,
  );

  if (completedReviewers.length === 0) {
    return (
      <span className="text-base text-neutral-gray4">
        {t('{count} Reviewed', { count: 0 })}
      </span>
    );
  }

  const names = completedReviewers.map((r) => r.profile.name).join(', ');

  return (
    <TooltipTrigger>
      <FocusableSpan className="text-base text-neutral-gray4 underline decoration-dotted underline-offset-2">
        {t('{count} Reviewed', { count: completedReviewers.length })}
      </FocusableSpan>
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
