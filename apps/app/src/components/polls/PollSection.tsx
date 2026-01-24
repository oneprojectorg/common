'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { CreatePollDialog } from './CreatePollDialog';
import { PollCard } from './PollCard';

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [data] = trpc.polls.listByTarget.useSuspenseQuery({
    targetType,
    targetId,
  });

  const polls = data?.polls ?? [];

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
          onPress={() => setIsDialogOpen(true)}
        >
          <LuPlus className="mr-1 h-3 w-3" />
          {t('Add Poll')}
        </Button>
      </div>

      {polls.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-gray2 bg-neutral-50 py-6 text-center">
          <p className="text-xs text-neutral-gray3">
            {t('No polls yet. Create one to get feedback.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <PollCard key={poll.id} pollId={poll.id} />
          ))}
        </div>
      )}

      <CreatePollDialog
        profileId={profileId}
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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-12 animate-pulse rounded bg-neutral-gray1" />
        <div className="h-6 w-20 animate-pulse rounded bg-neutral-gray1" />
      </div>
      <div className="h-32 animate-pulse rounded-lg bg-neutral-gray1" />
    </section>
  );
}
