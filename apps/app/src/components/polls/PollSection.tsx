'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { CreatePollDialog } from './CreatePollDialog';
import { PollCard } from './PollCard';

/**
 * PollSection displays all polls for a given target entity.
 * Features:
 * - Fetches polls via listByTarget procedure
 * - Renders PollCards for each poll
 * - "Add Poll" button to open CreatePollDialog
 * - Empty state when no polls exist
 */
export function PollSection({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  return (
    <Suspense fallback={<PollSectionSkeleton />}>
      <PollSectionContent targetType={targetType} targetId={targetId} />
    </Suspense>
  );
}

function PollSectionContent({
  targetType,
  targetId,
}: {
  targetType: string;
  targetId: string;
}) {
  const t = useTranslations();
  const { user } = useUser();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const profileId = user.currentOrganization?.id;

  if (!profileId) {
    return null;
  }

  const [data] = trpc.polls.listByTarget.useSuspenseQuery({
    targetType,
    targetId,
    profileId,
  });

  const polls = data?.polls ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-charcoal">
          {t('Polls')}
        </h2>
        <Button
          color="secondary"
          surface="outline"
          size="small"
          onPress={() => setIsDialogOpen(true)}
        >
          <LuPlus className="mr-1 h-4 w-4" />
          {t('Add Poll')}
        </Button>
      </div>

      {polls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-gray2 bg-neutral-50 py-8 text-center">
          <p className="text-sm text-neutral-gray3">
            {t('No polls yet. Create one to get feedback.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollCard key={poll.id} pollId={poll.id} />
          ))}
        </div>
      )}

      <CreatePollDialog
        targetType={targetType}
        targetId={targetId}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </section>
  );
}

function PollSectionSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-16 animate-pulse rounded bg-neutral-gray1" />
        <div className="h-8 w-24 animate-pulse rounded bg-neutral-gray1" />
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-neutral-gray1" />
    </section>
  );
}
