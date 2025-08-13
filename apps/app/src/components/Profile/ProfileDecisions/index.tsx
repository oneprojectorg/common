'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Suspense } from 'react';
import { LuLeaf, LuPlus } from 'react-icons/lu';

import { CreateDecisionProcessModal } from '../CreateDecisionProcessModal';

const DecisionProcessList = ({ profileId }: { profileId: string }) => {
  const [data] = trpc.decision.listInstances.useSuspenseQuery({
    ownerProfileId: profileId,
    limit: 20,
    offset: 0,
  });

  if (!data.instances || data.instances.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-neutral-gray1">
          <LuLeaf className="size-6 text-neutral-gray4" />
        </div>

        <div className="flex max-w-md flex-col gap-2">
          <h2 className="font-serif text-title-base text-neutral-black">
            Set up your decision-making process
          </h2>
          <p className="text-base text-neutral-charcoal">
            Create your first participatory budgeting or grantmaking process to
            start collecting proposals from your community.
          </p>
        </div>

        <DialogTrigger>
          <Button color="primary" size="medium" variant="icon">
            <LuPlus className="size-4" />
            Create Process
          </Button>
          <CreateDecisionProcessModal />
        </DialogTrigger>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-sm text-neutral-black">
          All processes
        </h2>

        <DialogTrigger>
          <Button color="primary" size="medium" variant="icon">
            <LuPlus className="size-4" />
            Create Process
          </Button>
          <CreateDecisionProcessModal />
        </DialogTrigger>
      </div>

      <div className="flex flex-col gap-4">
        {data.instances.map((instance) => (
          <div
            key={instance.id}
            className="flex items-center justify-between border-b border-neutral-gray1 px-0 py-6"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-base text-neutral-black">
                  {instance.name}
                </h3>
                <div className="flex items-start gap-1 text-sm text-neutral-charcoal">
                  {instance.instanceData?.budget && (
                    <>
                      <span>${instance.instanceData.budget.toLocaleString()} Budget</span>
                      <span>•</span>
                    </>
                  )}
                  <span>0 Proposals</span>
                  <span>•</span>
                  <span>48 Participants</span>
                </div>
              </div>
              {instance.description && (
                <p className="max-w-[640px] overflow-hidden text-ellipsis text-base text-neutral-charcoal">
                  {instance.description}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2.5 w-[147px]">
              <Button
                color="secondary"
                size="medium"
                onPress={() => {
                  // TODO: Navigate to instance details page
                  console.log('View details:', instance.id);
                }}
              >
                View Details
              </Button>
              <Button
                color="secondary"
                size="medium"
                onPress={() => {
                  // TODO: Navigate to edit process page
                  console.log('Edit process:', instance.id);
                }}
              >
                Edit Process
              </Button>
            </div>
          </div>
        ))}
      </div>

      {data.hasMore && (
        <div className="flex justify-center">
          <Button
            color="neutral"
            onPress={() => {
              // TODO: Load more instances
              console.log('Load more instances');
            }}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};

export const ProfileDecisions = ({ profileId }: { profileId: string }) => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="animate-pulse text-base text-neutral-charcoal">
            Loading...
          </div>
        </div>
      }
    >
      <DecisionProcessList profileId={profileId} />
    </Suspense>
  );
};

export const ProfileDecisionsSuspense = ({
  profileId,
}: {
  profileId: string;
}) => {
  return <ProfileDecisions profileId={profileId} />;
};
