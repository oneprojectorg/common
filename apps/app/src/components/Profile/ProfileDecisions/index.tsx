'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { getTextPreview } from '@op/core';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Header2, Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { DecisionListItem } from '@/components/decisions/DecisionListItem';

import type { SchemaType } from '../CreateDecisionProcessModal/schemas/schemaLoader';
import { EditDecisionProcessModal } from '../EditDecisionProcessModal';

const DecisionProfilesList = ({ profileId }: { profileId: string }) => {
  const [data] = trpc.decision.listDecisionProfiles.useSuspenseQuery({
    stewardProfileId: profileId,
    status: ProcessStatus.PUBLISHED,
  });

  if (!data.items.length) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {data.items.map((item) => (
        <DecisionListItem key={item.id} item={item} />
      ))}
    </div>
  );
};

const LegacyDecisionProcessList = ({
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
    stewardProfileId: profileId,
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
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Header2 className="font-serif text-title-sm">
          {t('Active processes')}
        </Header2>
      </div>

      <div className="flex flex-col gap-4">
        {data.instances.map((instance) => {
          // TODO: special key for People powered translations as a stop-gap
          const description = instance?.description?.match('PPDESCRIPTION')
            ? t('PPDESCRIPTION')
            : instance?.description;

          return (
            <div
              key={instance.id}
              className="flex flex-col items-center justify-between gap-4 border-b px-0 py-6 sm:flex-row"
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
                {description && (
                  <p className="max-w-2xl overflow-hidden text-base text-ellipsis text-neutral-charcoal sm:text-nowrap">
                    {getTextPreview({ content: description })}
                  </p>
                )}
              </div>

              <div className="flex w-full flex-col gap-2.5 sm:max-w-36">
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

const EmptyDecisions = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const access = useUser();
  const { user } = access;
  const permission = access.getPermissionsForProfile(profileId);
  const isOwnProfile = user.currentProfile?.id === profileId;
  const isProcessAdmin = permission.decisions.create && isOwnProfile;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-neutral-gray1">
        <LuLeaf className="size-6 text-neutral-gray4" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="font-serif text-title-base text-neutral-black">
          {isProcessAdmin
            ? t('Set up your decision-making process')
            : t('There are no current decision-making processes')}
        </h2>
        {isProcessAdmin && (
          <p className="text-base text-neutral-charcoal">
            {t(
              'Create your first participatory budgeting or grantmaking process to start collecting proposals from your community.',
            )}
          </p>
        )}
      </div>
    </div>
  );
};

const DecisionProcessList = ({
  profileId,
  schema = 'simple',
}: {
  profileId: string;
  schema?: SchemaType;
}) => {
  const [decisionProfiles] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery({
      stewardProfileId: profileId,
      status: ProcessStatus.PUBLISHED,
    });

  const legacyInstances = trpc.decision.listInstances.useQuery(
    { stewardProfileId: profileId, limit: 20, offset: 0 },
    { retry: false },
  );

  const hasDecisionProfiles = decisionProfiles.items.length > 0;
  const hasLegacyInstances = (legacyInstances.data?.instances?.length ?? 0) > 0;

  if (!hasDecisionProfiles && !hasLegacyInstances) {
    return <EmptyDecisions profileId={profileId} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <DecisionProfilesList profileId={profileId} />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <LegacyDecisionProcessList profileId={profileId} schema={schema} />
        </Suspense>
      </ErrorBoundary>
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
        <div className="flex min-h-96 items-center justify-center">
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
