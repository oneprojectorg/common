import { createServerUtils } from '@op/api/server';
import { Card } from '@op/sense/Card';
import { Skeleton } from '@op/sense/Skeleton';
import { getTranslations } from 'next-intl/server';

import { StatCard } from './StatCard';

/**
 * Platform statistics grid. Reads through `createServerUtils` on the server —
 * the numbers are not interactive, so the only thing that has to stay on the
 * client is {@link StatCard}'s active-route ring. Callers wrap this in their
 * own `Suspense` with {@link PlatformStatsSkeleton}.
 */
export const PlatformStats = async () => {
  const [t, { utils }] = await Promise.all([
    getTranslations(),
    createServerUtils(),
  ]);
  const stats = await utils.platform.admin.getStats.fetch();

  const statItems: Array<{
    label: string;
    value: number;
    href: string;
  }> = [
    {
      label: t('Total users'),
      value: stats.totalUsers,
      href: '/admin/users',
    },
    {
      label: t('Total organizations'),
      value: stats.totalOrganizations,
      href: '/admin/orgs',
    },
    {
      label: t('Total decisions'),
      value: stats.totalDecisionInstances,
      href: '/admin/decisions',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
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

/** Loading skeleton for platform stats */
export const PlatformStatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-8">
          <Skeleton className="h-24 w-40" />
        </Card>
      ))}
    </div>
  );
};
