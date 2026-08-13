'use client';

import { TabsContent, TabsTrigger } from '@op/sense/Tabs';
import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

export const FollowersTab = () => {
  const t = useTranslations();

  return <TabsTrigger value="followers">{t('Followers')}</TabsTrigger>;
};

export const FollowersTabPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <TabsContent
      value="followers"
      className={cn('px-4 py-2 sm:px-6 sm:py-0', className)}
    >
      {children}
    </TabsContent>
  );
};
