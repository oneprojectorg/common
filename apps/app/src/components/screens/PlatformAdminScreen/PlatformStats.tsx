'use client';

import { trpc } from '@op/api/client';
import { Surface } from '@op/ui/Surface';

import { useTranslations } from '@/lib/i18n';

export const PlatformStats = () => {
  const t = useTranslations();
  // Type is automatically inferred from tRPC router output
  const [stats] = trpc.platform.getStats.useSuspenseQuery();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Surface className="p-6">
        <div className="flex flex-col gap-2">
          <div className="text-md text-neutral-charcoal">
            {t('Total users')}
          </div>
          <div className="font-serif text-5xl font-light text-neutral-black">
            {stats.totalUsers}
          </div>
        </div>
      </Surface>
      <Surface className="p-6">
        <div className="text-md text-neutral-charcoal">
          {t('Total organizations')}
        </div>
        <div className="mt-2 font-serif text-5xl font-light text-neutral-black">
          {stats.totalOrganizations}
        </div>
      </Surface>
      <Surface className="p-6">
        <div className="text-md text-neutral-charcoal">
          {t('Total relationships')}
        </div>
        <div className="mt-2 font-serif text-5xl font-light text-neutral-black">
          {stats.totalRelationships}
        </div>
      </Surface>
      <Surface className="p-6">
        <div className="text-sm text-neutral-charcoal">
          {t('New organizations (7d)')}
        </div>
        <div className="mt-2 font-serif text-5xl font-light text-neutral-black">
          {stats.newOrganizations}
        </div>
      </Surface>
    </div>
  );
};

export const PlatformStatsSkeleton = () => {
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
