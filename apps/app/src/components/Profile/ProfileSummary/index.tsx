'use client';

import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Header1 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

const RelationshipCount = ({ profile }: { profile: Organization }) => {
  const t = useTranslations();
  const [{ count }] = trpc.organization.listRelationships.useSuspenseQuery({
    organizationId: profile.id,
  });

  return (
    count > 0 && (
      <Link href={`/org/${profile.slug}/relationships`}>
        <span className="font-bold text-teal">
          {count} {t('relationships')}
        </span>
      </Link>
    )
  );
};

export const ProfileSummary = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Header1>{profile.name}</Header1>
      {profile.city && profile.state ? (
        <div className="text-base text-neutral-gray4">
          {profile.city}, {profile.state}
        </div>
      ) : null}

      <div className="text-base text-neutral-charcoal">{profile.bio}</div>

      <ErrorBoundary fallback={null}>
        <div className="flex flex-col-reverse gap-6 sm:flex-col">
          <div className="flex gap-1 text-base text-neutral-gray4">
            <Suspense fallback={<Skeleton>482 relationships</Skeleton>}>
              <RelationshipCount profile={profile} />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
};
