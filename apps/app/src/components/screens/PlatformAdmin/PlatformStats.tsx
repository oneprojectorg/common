'use client';

import { trpc } from '@op/api/client';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { Suspense } from 'react';

import { Link, usePathname, useTranslations } from '@/lib/i18n';

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
  const [stats] = trpc.platform.admin.getStats.useSuspenseQuery();

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
  const pathname = usePathname();
  const isActive = href ? pathname.startsWith(href) : false;

  const content = (
    <Surface
      className={cn(
        'p-8',
        isActive && 'border-primary-teal ring-1 ring-primary-teal',
      )}
    >
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
      <Link
        href={href}
        className="no-underline hover:no-underline hover:opacity-80"
      >
        {content}
      </Link>
    );
  }

  return content;
};

/** Loading skeleton for platform stats */
const PlatformStatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Surface key={i} className="p-8">
          <Skeleton className="h-24 w-40" />
        </Surface>
      ))}
    </div>
  );
};
