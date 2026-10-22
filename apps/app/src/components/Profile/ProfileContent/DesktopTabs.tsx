'use client';

import { TabsTrigger } from '@op/sense/Tabs';

import { useTranslations } from '@/lib/i18n';

export const DesktopIndividualTabs = () => {
  const t = useTranslations();

  return (
    <>
      <TabsTrigger value="about">{t('profile.aboutTab')}</TabsTrigger>
      <TabsTrigger value="organizations">{t('Organizations')}</TabsTrigger>
      <TabsTrigger value="following">{t('profile.followingTab')}</TabsTrigger>
    </>
  );
};

export const DesktopOrganizationTabs = () => {
  const t = useTranslations();

  return (
    <>
      <TabsTrigger value="home">{t('posts.updatesTab')}</TabsTrigger>
      <TabsTrigger value="relationships">
        {t('profile.relationshipsTab')}
      </TabsTrigger>
    </>
  );
};
