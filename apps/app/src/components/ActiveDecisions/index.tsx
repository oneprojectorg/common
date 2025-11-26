'use client';

import { skipBatch, trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ProfileItem } from '@op/ui/ProfileItem';
import { Surface } from '@op/ui/Surface';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';

import { getTextPreview } from '@/utils/proposalUtils';

import ErrorBoundary from '../ErrorBoundary';
import { OrganizationAvatar } from '../OrganizationAvatar';

const ActiveDecisionsSuspense = () => {
  const router = useRouter();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const [{ items: decisions }] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery(
      {
        status: ProcessStatus.PUBLISHED,
        limit: 10,
      },
      {
        ...skipBatch,
      },
    );

  const count = decisions.length;

  return count > 0 ? (
    <Surface className="flex flex-col gap-0 border-b">
      <Header2 className="flex items-center gap-1 p-6 font-serif text-title-sm text-neutral-black">
        Active Decisions{' '}
        <span className="flex size-4 items-center justify-center rounded-full bg-functional-red font-sans text-xs text-neutral-offWhite">
          {count}
        </span>
      </Header2>
      <ul className="flex flex-col">
        {decisions.map((decision) => {
          const instance = decision.processInstance;
          const isPending = navigatingId === decision.id;
          const description = instance?.description;

          return (
            <li
              key={decision.id}
              className="flex flex-col justify-between gap-6 border-t p-6 transition-colors sm:flex-row sm:items-center sm:gap-2"
            >
              <ProfileItem
                avatar={<OrganizationAvatar profile={decision} />}
                title={decision.name}
                description={
                  description
                    ? getTextPreview({ content: description })
                    : undefined
                }
              />
              <div className="flex items-center gap-4">
                <Button
                  size="small"
                  className="w-full sm:w-auto"
                  onPress={() => {
                    setNavigatingId(decision.id);
                    router.push(
                      `/profile/${decision.slug}/decisions/${instance?.id}`,
                    );
                  }}
                  isDisabled={isPending}
                >
                  {isPending ? <LoadingSpinner /> : 'Participate'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  ) : null;
};

export const ActiveDecisions = () => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <ActiveDecisionsSuspense />
      </Suspense>
    </ErrorBoundary>
  );
};
