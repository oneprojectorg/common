'use client';

import { usePollSubscription } from '@/hooks/usePollSubscription';
import { trpc } from '@op/api/client';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { cn } from '@op/ui/utils';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Vibrant color palette for poll options (Mentimeter-inspired)
 */
const OPTION_COLORS = [
  'bg-[hsl(186,96%,33%)]', // teal (brand primary)
  'bg-[hsl(270,100%,50%)]', // purple
  'bg-[hsl(340,82%,52%)]', // pink
  'bg-[hsl(39,96%,48%)]', // orange
  'bg-[hsl(101,100%,38%)]', // green
  'bg-[hsl(218,100%,50%)]', // blue
  'bg-[hsl(16,96%,48%)]', // red-orange
  'bg-[hsl(45,90%,50%)]', // yellow
];

/**
 * PollParticipateDialog displays a poll in a modal for voting.
 * Mentimeter-inspired design with animated progress bars and vibrant colors.
 */
export function PollParticipateDialog({
  pollId,
  isOpen,
  onOpenChange,
}: {
  pollId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [poll] = trpc.polls.get.useSuspenseQuery({ pollId });
  const [showConfetti, setShowConfetti] = useState(false);

  const voteMutation = trpc.polls.vote.useMutation({
    onSuccess: () => {
      utils.polls.get.invalidate({ pollId });
      setShowConfetti(true);
    },
  });

  // Subscribe to real-time updates
  usePollSubscription(pollId);

  const handleVote = (optionIndex: number) => {
    if (poll.status === 'closed' || voteMutation.isPending) {
      return;
    }
    voteMutation.mutate({ pollId, optionIndex });
  };

  const isPollClosed = poll.status === 'closed';
  const hasVoted = poll.userVote !== null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      confetti={showConfetti}
    >
      <ModalHeader>{poll.question}</ModalHeader>
      <ModalBody className="p-0">
        {/* Status badge */}
        {isPollClosed && (
          <div className="bg-neutral-50 px-4 py-2">
            <span className="rounded-full bg-neutral-gray2 px-2 py-0.5 text-xs font-medium text-neutral-charcoal">
              {t('Closed')}
            </span>
          </div>
        )}

        {/* Options */}
        <div className="space-y-2 p-4">
          {poll.options.map((option, index) => {
            const percentage =
              poll.totalVotes > 0
                ? Math.round((option.voteCount / poll.totalVotes) * 100)
                : 0;
            const isSelected = poll.userVote === index;
            const colorClass = OPTION_COLORS[index % OPTION_COLORS.length];

            return (
              <button
                key={option.text}
                type="button"
                onClick={() => handleVote(index)}
                disabled={isPollClosed || voteMutation.isPending}
                className={cn(
                  'group relative w-full overflow-hidden rounded text-left transition-all duration-200',
                  !isPollClosed &&
                    'cursor-pointer hover:scale-[1.005] hover:shadow-sm',
                  isPollClosed && 'cursor-default',
                  isSelected && 'ring-1 ring-primary-teal ring-offset-1',
                )}
              >
                {/* Background bar (animated) */}
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 transition-all duration-700 ease-out',
                    colorClass,
                    poll.totalVotes === 0 && 'opacity-30',
                  )}
                  style={{ width: `${Math.max(percentage, 0)}%` }}
                />

                {/* Content overlay */}
                <div className="relative flex min-h-[44px] items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary-teal shadow-sm">
                        <svg
                          className="h-2.5 w-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-sm font-medium transition-colors',
                        percentage > 50
                          ? 'text-white'
                          : 'text-neutral-charcoal',
                      )}
                    >
                      {option.text}
                    </span>
                  </div>

                  {/* Percentage + count */}
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        'text-base font-bold tabular-nums transition-colors',
                        percentage > 50
                          ? 'text-white'
                          : 'text-neutral-charcoal',
                      )}
                    >
                      {percentage}%
                    </span>
                    <span
                      className={cn(
                        'text-xs tabular-nums transition-colors',
                        percentage > 50
                          ? 'text-white/70'
                          : 'text-neutral-charcoal/60',
                      )}
                    >
                      ({option.voteCount})
                    </span>
                  </div>
                </div>

                {/* Subtle background for unvoted options */}
                {poll.totalVotes === 0 && (
                  <div
                    className={cn('absolute inset-0 opacity-10', colorClass)}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-gray1 bg-neutral-50 px-4 py-3">
          <span className="text-sm text-neutral-charcoal/70">
            {poll.totalVotes} {poll.totalVotes === 1 ? t('vote') : t('votes')}
          </span>
          {hasVoted && !isPollClosed && (
            <span className="flex items-center gap-1 text-sm font-medium text-primary-teal">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('You voted')}
            </span>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
