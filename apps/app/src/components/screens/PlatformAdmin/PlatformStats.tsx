'use client';

import { trpcOptions } from '@op/api/trpcTanstackQuery';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

/** Main platform stats component with suspense boundary */
export const PlatformStats = () => {
  return (
    <Suspense fallback={<PlatformStatsSkeleton />}>
      <PlatformStatsWithData />
    </Suspense>
  );
};

/** Renders platform statistics grid with live data */
const PlatformStatsWithData = () => {
  const t = useTranslations();
  const { data: stats } = useSuspenseQuery(
    trpcOptions.platform.getStats.queryOptions(),
  );

  const statItems = [
    { label: t('platformAdmin_totalUsers'), value: stats.totalUsers },
    {
      label: t('platformAdmin_totalOrganizations'),
      value: stats.totalOrganizations,
    },
    {
      label: t('platformAdmin_totalRelationships'),
      value: stats.totalRelationships,
    },
    {
      label: t('platformAdmin_newOrganizations'),
      value: stats.newOrganizations,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat) => (
        <StatCard key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
};

/** Individual stat card displaying label and numeric value */
const StatCard = ({ label, value }: { label: string; value: number }) => {
  return (
    <Surface className="p-8">
      <div className="flex flex-col gap-2">
        <div className="text-neutral-charcoal">{label}</div>
        <div className="font-serif text-title-xxl text-neutral-black">
          {value}
        </div>
      </div>
    </Surface>
  );
};

/** Loading skeleton for platform stats */
const PlatformStatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Surface key={i} className="p-8">
          <Skeleton className="h-24 w-40" />
        </Surface>
      ))}
    </div>
  );
};
