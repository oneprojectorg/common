import { trpc } from '@op/trpc/client';
import type { Organization } from '@op/trpc/encoders';
import { Header1 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

const RelationshipCount = ({ profileId }: { profileId: string }) => {
  const t = useTranslations();
  const [{ count }] = trpc.organization.listRelationships.useSuspenseQuery({
    from: profileId,
  });

  return (
    <>
      <span className="font-semibold">{count}</span> {t('relationships')}
    </>
  );
};

export const ProfileSummary = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex flex-col gap-0 py-2 sm:gap-2">
      <Header1>{profile.name}</Header1>
      <div className="text-base text-neutral-gray4">
        {profile.city && profile.state
          ? `${profile.city}, ${profile.state}`
          : null}
      </div>
      <ErrorBoundary fallback={null}>
        <div className="flex flex-col-reverse gap-6 sm:flex-col">
          <div className="flex gap-1 text-base text-neutral-gray4">
            <Suspense fallback={<Skeleton>482 relationships</Skeleton>}>
              <RelationshipCount profileId={profile.id} />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
};
