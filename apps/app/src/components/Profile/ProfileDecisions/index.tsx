'use client';

import { useUser } from '@/utils/UserProvider';
import { getTextPreview } from '@/utils/proposalUtils';
import { trpc } from '@op/api/client';
import { Button, ButtonLink } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Header2, Header3 } from '@op/ui/Header';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { LuLeaf, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CreateDecisionProcessModal } from '../CreateDecisionProcessModal';
import { EditDecisionProcessModal } from '../EditDecisionProcessModal';

const DecisionProcessList = ({ profileId }: { profileId: string }) => {
  const { slug } = useParams();
  const t = useTranslations();
  const [data] = trpc.decision.listInstances.useSuspenseQuery({
    ownerProfileId: profileId,
    limit: 20,
    offset: 0,
  });
  const access = useUser();
  const { user } = access;

  const permission = access.getPermissionsForProfile(profileId);
  const decisionPermission = permission.decisions;
  const isOwnProfile = user?.currentProfile?.id === profileId;

  if (!data.instances || data.instances.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        {decisionPermission.create && isOwnProfile ? (
          <>
            <div className="flex size-10 items-center justify-center rounded-full bg-neutral-gray1">
              <LuLeaf className="size-6 text-neutral-gray4" />
            </div>

            <div className="flex max-w-md flex-col gap-2">
              <h2 className="font-serif text-title-base text-neutral-black">
                {t('Set up your decision-making process')}
              </h2>
              <p className="text-base text-neutral-charcoal">
                {t(
                  'Create your first participatory budgeting or grantmaking process to start collecting proposals from your community.',
                )}
              </p>
            </div>

            <DialogTrigger>
              <Button color="primary" size="medium" variant="icon">
                <LuPlus className="size-4" />
                {t('Create Process')}
              </Button>
              <CreateDecisionProcessModal />
            </DialogTrigger>
          </>
        ) : (
          <>
            <div className="flex size-10 items-center justify-center rounded-full bg-neutral-gray1">
              <LuLeaf className="size-6 text-neutral-gray4" />
            </div>

            <div className="flex max-w-md flex-col gap-2">
              <h2 className="font-serif text-title-base text-neutral-black">
                {t('There are no current decision-making processes')}
              </h2>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Header2 className="font-serif text-title-sm">
          {t('Active processes')}
        </Header2>

        {decisionPermission.create && isOwnProfile ? (
          <DialogTrigger>
            <Button color="primary" size="medium" variant="icon">
              <LuPlus className="size-4" />
              {t('Create Process')}
            </Button>
            <CreateDecisionProcessModal />
          </DialogTrigger>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {data.instances.map((instance) => (
          <div
            key={instance.id}
            className="flex flex-col items-center justify-between gap-4 border-b border-neutral-gray1 px-0 py-6 sm:flex-row"
          >
            <div className="flex w-full flex-col gap-2">
              <div className="flex flex-col gap-1">
                <Header3 className="text-base font-bold">
                  {instance.name}
                </Header3>
                <div className="flex items-start gap-1 text-sm text-neutral-charcoal">
                  {instance.instanceData?.budget &&
                    !instance.instanceData?.hideBudget && (
                      <>
                        <span>
                          ${instance.instanceData.budget.toLocaleString()}{' '}
                          {t('Budget')}
                        </span>
                        <span>•</span>
                      </>
                    )}
                  <span>
                    {instance.proposalCount || 0} {t('Proposals')}
                  </span>
                  <span>•</span>
                  <span>
                    {instance.participantCount || 0} {t('Participants')}
                  </span>
                </div>
              </div>
              {instance.description && (
                <p className="max-w-2xl overflow-hidden text-ellipsis text-base text-neutral-charcoal sm:text-nowrap">
                  {getTextPreview(instance.description)}
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:max-w-36">
              {decisionPermission.update ? (
                <ButtonLink
                  color="secondary"
                  href={`/profile/${slug}/decisions/${instance.id}`}
                  className="w-full"
                >
                  {t('View Details')}
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={`/profile/${slug}/decisions/${instance.id}`}
                  className="w-full"
                >
                  {t('Participate')}
                </ButtonLink>
              )}

              {decisionPermission.create ? (
                <DialogTrigger>
                  <Button color="secondary" className="w-full">
                    {t('Edit Process')}
                  </Button>
                  <EditDecisionProcessModal instance={instance} />
                </DialogTrigger>
              ) : null}
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
            {t('Load More')}
          </Button>
        </div>
      )}
    </div>
  );
};

export const ProfileDecisions = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-96 items-center justify-center">
          <div className="animate-pulse text-base text-neutral-charcoal">
            {t('Loading...')}
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
