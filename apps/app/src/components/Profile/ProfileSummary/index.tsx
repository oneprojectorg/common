'use client';

import { pluralize } from '@/utils/pluralize';
import { skipBatch, trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Header1 } from '@op/ui/Header';
import { Skeleton } from '@op/ui/Skeleton';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

const RelationshipCount = ({ profile }: { profile: Organization }) => {
  const t = useTranslations();
  const input = { organizationId: profile.id };
  const { data: { count } } = useSuspenseQuery({
    queryKey: [['organization', 'listRelationships'], input],
    queryFn: () => trpc.organization.listRelationships.query(input),
    ...skipBatch,
  });

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
    <div className="flex flex-col gap-2 py-2">
      <Header1>{profile.profile.name}</Header1>

      {whereWeWork.length ? (
        <div className="text-base text-neutral-gray4">{whereWeWork}</div>
      ) : null}

      <div className="max-w-xl text-base text-neutral-charcoal">
        {profile.profile.bio}
      </div>

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
