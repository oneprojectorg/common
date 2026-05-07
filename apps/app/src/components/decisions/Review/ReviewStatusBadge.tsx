import type { ProposalReviewAssignment } from '@op/common/client';
import { cn } from '@op/ui/utils';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuRefreshCw,
  LuTimer,
} from 'react-icons/lu';

import type { TranslationKey } from '@/lib/i18n';

import { TranslatedText } from '@/components/TranslatedText';

type AssignmentStatus = ProposalReviewAssignment['status'];

const statusConfig: Record<
  AssignmentStatus,
  {
    icon: typeof LuCircleDashed;
    bgClass: string;
    textClass: string;
    iconClass: string;
  }
> = {
  pending: {
    icon: LuCircleDashed,
    bgClass: 'bg-neutral-offWhite p-2',
    textClass: 'text-neutral-gray4',
    iconClass: 'text-neutral-gray4',
  },
  in_progress: {
    icon: LuTimer,
    bgClass: 'bg-primary-tealWhite p-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-primary-teal',
  },
  completed: {
    icon: LuCircleCheck,
    bgClass: 'bg-status-greenBg p-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-status-green',
  },
  awaiting_author_revision: {
    icon: LuRefreshCw,
    bgClass: 'bg-white py-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-primary-orange2',
  },
  ready_for_re_review: {
    icon: LuCircleAlert,
    bgClass: 'bg-functional-yellowWhite p-2',
    textClass: 'text-neutral-charcoal',
    iconClass: 'text-primary-orange2',
  },
};

const statusLabels: Record<AssignmentStatus, TranslationKey> = {
  pending: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  awaiting_author_revision: 'Revision Requested',
  ready_for_re_review: 'Needs Review',
};

export function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
  const { icon: Icon, bgClass, textClass, iconClass } = statusConfig[status];

  return (
    <div className={cn('flex w-fit items-center gap-1 rounded-lg', bgClass)}>
      <Icon className={cn('size-4', iconClass)} />
      <span className={cn('text-base', textClass)}>
        <TranslatedText text={statusLabels[status]} />
      </span>
    </div>
  );
}
