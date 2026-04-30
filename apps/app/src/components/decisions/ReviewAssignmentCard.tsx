import type {
  ProposalReviewAssignment,
  ReviewAssignmentExtended,
} from '@op/common/client';
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

import { Bullet } from '../Bullet';
import {
  ProposalCard,
  ProposalCardAuthor,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
  ProposalCardPreview,
} from './ProposalCard';

type AssignmentStatus = ProposalReviewAssignment['status'];

interface ReviewAssignmentCardProps {
  assignment: ReviewAssignmentExtended;
  viewHref?: string;
}

export function ReviewAssignmentCard({
  assignment: { assignment },
  viewHref,
}: ReviewAssignmentCardProps) {
  const { proposal, status } = assignment;
  const isRevised = status === 'ready_for_re_review';

  return (
    <ProposalCard proposal={proposal} className="rounded-lg">
      <ProposalCardContent>
        <ProposalCardHeader proposal={proposal} viewHref={viewHref} />
        <div className="flex flex-wrap items-center gap-2">
          <ProposalCardAuthor proposal={proposal} />
          <ProposalCardCategory proposal={proposal} />
          {isRevised && (
            <>
              <Bullet />
              <div className="flex items-center gap-1">
                <LuRefreshCw className="size-4 text-warning" />
                <span className="text-sm text-foreground">
                  <TranslatedText text="Revised" />
                </span>
              </div>
            </>
          )}
        </div>
        <ProposalCardPreview proposal={proposal} className="line-clamp-2" />
      </ProposalCardContent>
      <ReviewStatusBadge status={status} />
    </ProposalCard>
  );
}

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
    bgClass: 'bg-muted p-2',
    textClass: 'text-muted-foreground',
    iconClass: 'text-muted-foreground',
  },
  in_progress: {
    icon: LuTimer,
    bgClass: 'bg-primary/10 p-2',
    textClass: 'text-foreground',
    iconClass: 'text-primary',
  },
  completed: {
    icon: LuCircleCheck,
    bgClass: 'bg-positive/10 p-2',
    textClass: 'text-foreground',
    iconClass: 'text-positive',
  },
  awaiting_author_revision: {
    icon: LuRefreshCw,
    bgClass: 'bg-white py-2',
    textClass: 'text-foreground',
    iconClass: 'text-warning',
  },
  ready_for_re_review: {
    icon: LuCircleAlert,
    bgClass: 'bg-warning-foreground p-2',
    textClass: 'text-foreground',
    iconClass: 'text-warning',
  },
};

const statusLabels: Record<AssignmentStatus, TranslationKey> = {
  pending: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  awaiting_author_revision: 'Revision Requested',
  ready_for_re_review: 'Needs Review',
};

function ReviewStatusBadge({ status }: { status: AssignmentStatus }) {
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
