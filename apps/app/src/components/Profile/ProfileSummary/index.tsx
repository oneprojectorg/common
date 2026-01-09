'use client';

import { pluralize } from '@/utils/pluralize';
import { skipBatch, trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Header1 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

const RelationshipCount = ({ profile }: { profile: Organization }) => {
  const t = useTranslations();
  const [{ count }] = trpc.organization.listRelationships.useSuspenseQuery(
    {
      organizationId: profile.id,
    },
    {
      ...skipBatch,
    },
  );

  return (
    count > 0 && (
      <Link href={`/org/${profile.profile.slug}/relationships`}>
        <span className="font-bold text-teal">
          {count} {pluralize(t('relationship'), count)}
        </span>
      </Link>
    )
  );
};

export const ProfileSummary = ({ profile }: { profile: Organization }) => {
  const whereWeWork = profile.whereWeWork
    .map((location) => location.name)
    .join(' • ');

  return (
    <div className="gap-2 py-2 flex flex-col">
      <Header1>{profile.profile.name}</Header1>

      {whereWeWork.length ? (
        <div className="text-base text-neutral-gray4">{whereWeWork}</div>
      ) : null}

      <div className="max-w-xl text-base text-neutral-charcoal">
        {profile.profile.bio}
      </div>

      <ErrorBoundary fallback={null}>
        <div className="gap-6 sm:flex-col flex flex-col-reverse">
          <div className="gap-1 flex text-base text-neutral-gray4">
            <Suspense fallback={<Skeleton>482 relationships</Skeleton>}>
              <RelationshipCount profile={profile} />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    </div>
  );
};
