'use client';

import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { Suspense } from 'react';

import { Link, useTranslations } from '@/lib/i18n';

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

  const statItems: Array<{
    label: string;
    value: number;
    href?: string;
  }> = [
    { label: t('Total users'), value: stats.totalUsers },
    {
      label: t('Total organizations'),
      value: stats.totalOrganizations,
    },
    {
      label: t('Total decisions'),
      value: stats.totalDecisionInstances,
      href: '/admin/decisions',
    },
    {
      label: t('New organizations'),
      value: stats.newOrganizations,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          href={stat.href}
        />
      ))}
    </div>
  );
};

/** Individual stat card displaying label and numeric value */
const StatCard = ({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) => {
  const content = (
    <Surface className="p-8">
      <div className="flex flex-col gap-2">
        <div className="text-neutral-charcoal">{label}</div>
        <div className="font-serif text-title-xxl text-neutral-black">
          {value}
        </div>
      </div>
    </Surface>
  );

  if (href) {
    return (
      <Link href={href} className="no-underline hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
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
