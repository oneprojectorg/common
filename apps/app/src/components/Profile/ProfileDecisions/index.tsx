'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { VISIBLE_DECISION_STATUSES } from '@op/api/encoders';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DecisionListItem,
  LegacyDecisionListItem,
} from '@/components/decisions/DecisionListItem';

const DecisionProfilesList = ({ profileId }: { profileId: string }) => {
  const [data] = trpc.decision.listDecisionProfiles.useSuspenseQuery({
    stewardProfileId: profileId,
    status: VISIBLE_DECISION_STATUSES,
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

const LegacyDecisionProcessList = ({ profileId }: { profileId: string }) => {
  const { slug } = useParams();
  const [data] = trpc.decision.listLegacyInstances.useSuspenseQuery({
    ownerProfileId: profileId,
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {data.map((instance) => {
        const currentState = instance.process?.processSchema?.states?.find(
          (s) => s.id === instance.currentStateId,
        );
        const currentPhase = instance.instanceData?.phases?.find(
          (p) => p.phaseId === instance.instanceData?.currentPhaseId,
        );

        return (
          <LegacyDecisionListItem
            key={instance.id}
            name={instance.name}
            href={`/profile/${slug}/decisions/${instance.id}`}
            currentStateName={currentState?.name}
            closingDate={currentPhase?.endDate}
            ownerName={instance.owner?.name}
            ownerAvatarPath={instance.owner?.avatarImage?.name}
            participantCount={instance.participantCount ?? 0}
            proposalCount={instance.proposalCount ?? 0}
          />
        );
      })}
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

const DecisionProcessList = ({ profileId }: { profileId: string }) => {
  const access = useUser();
  const canReadDecisions =
    access.getPermissionsForProfile(profileId).decisions.read;

  const [decisionProfiles] =
    trpc.decision.listDecisionProfiles.useSuspenseQuery({
      stewardProfileId: profileId,
      status: VISIBLE_DECISION_STATUSES,
    });

  const legacyInstances = trpc.decision.listLegacyInstances.useQuery(
    { ownerProfileId: profileId },
    { retry: false, enabled: canReadDecisions },
  );

  const hasDecisionProfiles = decisionProfiles.items.length > 0;
  const hasLegacyInstances = (legacyInstances.data?.length ?? 0) > 0;

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
          <LegacyDecisionProcessList profileId={profileId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export const ProfileDecisionsSuspense = ({
  profileId,
}: {
  profileId: string;
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
      <DecisionProcessList profileId={profileId} />
    </Suspense>
  );
};
