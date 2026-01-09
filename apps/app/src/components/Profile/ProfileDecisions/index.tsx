'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { getTextPreview } from '@op/core';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Header2, Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SchemaType } from '../CreateDecisionProcessModal/schemas/schemaLoader';
import { EditDecisionProcessModal } from '../EditDecisionProcessModal';

const DecisionProcessList = ({
  profileId,
  schema = 'simple',
}: {
  profileId: string;
  schema?: SchemaType;
}) => {
  const { slug } = useParams();
  const router = useRouter();
  const t = useTranslations();
  const [navigatingInstanceId, setNavigatingInstanceId] = useState<
    string | null
  >(null);
  const [data] = trpc.decision.listInstances.useSuspenseQuery({
    ownerProfileId: profileId,
    limit: 20,
    offset: 0,
  });
  const access = useUser();
  const { user } = access;

  const permission = access.getPermissionsForProfile(profileId);
  const decisionPermission = permission.decisions;
  const isOwnProfile = user.currentProfile?.id === profileId;
  const isProcessAdmin = decisionPermission.create && isOwnProfile;

  if (!data.instances || data.instances.length === 0) {
    return (
      <div className="gap-6 px-6 py-16 flex min-h-[400px] flex-col items-center justify-center text-center">
        {isProcessAdmin ? (
          <>
            <div className="size-10 flex items-center justify-center rounded-full bg-neutral-gray1">
              <LuLeaf className="size-6 text-neutral-gray4" />
            </div>

            <div className="max-w-md gap-2 flex flex-col">
              <h2 className="font-serif text-title-base text-neutral-black">
                {t('Set up your decision-making process')}
              </h2>
              <p className="text-base text-neutral-charcoal">
                {t(
                  'Create your first participatory budgeting or grantmaking process to start collecting proposals from your community.',
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="size-10 flex items-center justify-center rounded-full bg-neutral-gray1">
              <LuLeaf className="size-6 text-neutral-gray4" />
            </div>

            <div className="max-w-md gap-2 flex flex-col">
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
    <div className="gap-4 flex flex-col">
      <div className="flex items-center justify-between">
        <Header2 className="font-serif text-title-sm">
          {t('Active processes')}
        </Header2>
      </div>

      <div className="gap-4 flex flex-col">
        {data.instances.map((instance) => {
          // TODO: special key for People powered translations as a stop-gap
          const description = instance?.description?.match('PPDESCRIPTION')
            ? t('PPDESCRIPTION')
            : instance?.description;

          return (
            <div
              key={instance.id}
              className="gap-4 px-0 py-6 sm:flex-row flex flex-col items-center justify-between border-b border-neutral-gray1"
            >
              <div className="gap-2 flex w-full flex-col">
                <div className="gap-1 flex flex-col">
                  <Header3 className="font-bold text-base">
                    {instance.name}
                  </Header3>
                  <div className="gap-1 flex items-start text-sm text-neutral-charcoal">
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
                {description && (
                  <p className="max-w-2xl sm:text-nowrap overflow-hidden text-base text-ellipsis text-neutral-charcoal">
                    {getTextPreview({ content: description })}
                  </p>
                )}
              </div>

              <div className="gap-2.5 sm:max-w-36 flex w-full flex-col">
                {isProcessAdmin ? (
                  <Button
                    color="secondary"
                    className="w-full"
                    isDisabled={navigatingInstanceId === instance.id}
                    onPress={() => {
                      setNavigatingInstanceId(instance.id);
                      router.push(`/profile/${slug}/decisions/${instance.id}`);
                    }}
                  >
                    {navigatingInstanceId === instance.id ? (
                      <LoadingSpinner />
                    ) : null}
                    {t('View Details')}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    isDisabled={navigatingInstanceId === instance.id}
                    onPress={() => {
                      setNavigatingInstanceId(instance.id);
                      router.push(`/profile/${slug}/decisions/${instance.id}`);
                    }}
                  >
                    {navigatingInstanceId === instance.id ? (
                      <LoadingSpinner />
                    ) : null}
                    {t('Participate')}
                  </Button>
                )}

                {isProcessAdmin ? (
                  <DialogTrigger>
                    <Button color="secondary" className="w-full">
                      {t('Edit Process')}
                    </Button>
                    <EditDecisionProcessModal
                      instance={instance}
                      schema={schema}
                    />
                  </DialogTrigger>
                ) : null}
              </div>
            </div>
          );
        })}
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

export const ProfileDecisionsSuspense = ({
  profileId,
  schema = 'simple',
}: {
  profileId: string;
  schema?: SchemaType;
}) => {
  const t = useTranslations();

  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center">
          <div className="animate-pulse text-base text-neutral-charcoal">
            {t('Loading...')}
          </div>
        </div>
      }
    >
      <DecisionProcessList profileId={profileId} schema={schema} />
    </Suspense>
  );
};
