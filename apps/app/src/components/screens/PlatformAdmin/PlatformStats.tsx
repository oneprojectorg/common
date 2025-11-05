'use client';

import { trpc } from '@op/api/client';
import { Surface } from '@op/ui/Surface';
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
  const [stats] = trpc.platform.getStats.useSuspenseQuery();

  const statItems = [
    { label: t('Total users'), value: stats.totalUsers },
    { label: t('Total organizations'), value: stats.totalOrganizations },
    { label: t('Total relationships'), value: stats.totalRelationships },
    { label: t('New organizations (7d)'), value: stats.newOrganizations },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat) => (
        <StatCard key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
};

/** Individual stat card displaying label and numeric value */
const StatCard = ({ label, value }: { label: string; value: number }) => {
  return (
    <Surface className="p-6">
      <div className="flex flex-col gap-2">
        <div className="text-md text-neutral-charcoal">{label}</div>
        <div className="font-serif text-5xl font-light text-neutral-black">
          {value}
        </div>
      </div>
    </Surface>
  );
};

/** Loading skeleton for platform stats */
const PlatformStatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Surface key={i} className="p-6">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-gray1" />
          <div className="mt-2 h-12 w-24 animate-pulse rounded bg-neutral-gray1" />
        </Surface>
      ))}
    </div>
  );
};
