'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import {
  NotificationPanel,
  NotificationPanelActions,
  NotificationPanelItem,
  NotificationPanelList,
} from '@op/ui/NotificationPanel';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { CreatePollDialog } from './CreatePollDialog';
import { PollParticipateDialog } from './PollParticipateDialog';

/**
 * PollSection displays all polls for a given target entity.
 *
 * @param profileId - The profile (organization) ID the polls belong to.
 *                    Required for creating new polls.
 * @param targetType - The type of entity (e.g., "proposal")
 * @param targetId - The ID of the target entity
 */
export function PollSection({
  profileId,
  targetType,
  targetId,
}: {
  profileId: string;
  targetType: string;
  targetId: string;
}) {
  return (
    <Suspense fallback={<PollSectionSkeleton />}>
      <PollSectionContent
        profileId={profileId}
        targetType={targetType}
        targetId={targetId}
      />
    </Suspense>
  );
}

function PollSectionContent({
  profileId,
  targetType,
  targetId,
}: {
  profileId: string;
  targetType: string;
  targetId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Get pollId from URL query params
  const pollIdFromUrl = searchParams.get('pollId');

  const [data] = trpc.polls.listByTarget.useSuspenseQuery({
    targetType,
    targetId,
  });

  const polls = data?.polls ?? [];

  // Update URL when opening/closing poll modal
  const setParticipatingPollId = useCallback(
    (pollId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (pollId) {
        params.set('pollId', pollId);
      } else {
        params.delete('pollId');
      }
      const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Determine if the poll from URL actually exists in this target's polls
  const participatingPollId =
    pollIdFromUrl && polls.some((p) => p.id === pollIdFromUrl)
      ? pollIdFromUrl
      : null;

  if (polls.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-charcoal">
            {t('Polls')}
          </h2>
          <Button
            color="secondary"
            surface="outline"
            size="small"
            onPress={() => setIsCreateDialogOpen(true)}
          >
            <LuPlus className="mr-1 h-3 w-3" />
            {t('Add Poll')}
          </Button>
        </div>

        <div className="rounded border border-dashed border-neutral-gray2 bg-neutral-50 py-6 text-center">
          <p className="text-xs text-neutral-gray3">
            {t('No polls yet. Create one to get feedback.')}
          </p>
        </div>

        <CreatePollDialog
          profileId={profileId}
          targetType={targetType}
          targetId={targetId}
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </section>
    );
  }

  return (
    <>
      <NotificationPanel>
        <div className="flex items-center justify-between p-3">
          <h2 className="flex items-center gap-1 text-sm font-semibold text-neutral-charcoal">
            {t('Polls')}
            <span className="flex size-4 items-center justify-center rounded-full bg-functional-red text-xs text-neutral-offWhite">
              {polls.length}
            </span>
          </h2>
          <Button
            color="secondary"
            surface="outline"
            size="small"
            onPress={() => setIsCreateDialogOpen(true)}
          >
            <LuPlus className="mr-1 h-3 w-3" />
            {t('Add Poll')}
          </Button>
        </div>
        <NotificationPanelList>
          {polls.map((poll) => (
            <PollNotificationItem
              key={poll.id}
              poll={poll}
              onParticipate={() => setParticipatingPollId(poll.id)}
            />
          ))}
        </NotificationPanelList>
      </NotificationPanel>

      <CreatePollDialog
        profileId={profileId}
        targetType={targetType}
        targetId={targetId}
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {participatingPollId && (
        <Suspense fallback={null}>
          <PollParticipateDialog
            pollId={participatingPollId}
            isOpen={!!participatingPollId}
            onOpenChange={(open) => {
              if (!open) {
                setParticipatingPollId(null);
              }
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function PollNotificationItem({
  poll,
  onParticipate,
}: {
  poll: { id: string; question: string; totalVotes: number; status: string };
  onParticipate: () => void;
}) {
  const t = useTranslations();
  const isPollClosed = poll.status === 'closed';

  return (
    <NotificationPanelItem>
      <div className="flex flex-col">
        <span className="font-semibold text-neutral-black">
          {poll.question}
        </span>
        <span className="text-neutral-charcoal">
          {poll.totalVotes} {poll.totalVotes === 1 ? t('vote') : t('votes')}
          {isPollClosed && (
            <span className="ml-2 rounded-full bg-neutral-gray2 px-1.5 py-0.5 text-xs text-neutral-charcoal">
              {t('Closed')}
            </span>
          )}
        </span>
      </div>
      <NotificationPanelActions>
        <Button size="small" onPress={onParticipate}>
          {isPollClosed ? t('View Results') : t('Participate')}
        </Button>
      </NotificationPanelActions>
    </NotificationPanelItem>
  );
}

function PollSectionSkeleton() {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-12 animate-pulse rounded bg-neutral-gray1" />
        <div className="h-6 w-20 animate-pulse rounded bg-neutral-gray1" />
      </div>
      <div className="h-32 animate-pulse rounded-lg bg-neutral-gray1" />
    </section>
  );
}
