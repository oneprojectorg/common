'use client';

import { TabsTrigger } from '@op/sense/Tabs';

import { useTranslations } from '@/lib/i18n';

export const DesktopIndividualTabs = () => {
  const t = useTranslations();

  return (
    <>
      <TabsTrigger value="about">{t('About')}</TabsTrigger>
      <TabsTrigger value="organizations">{t('Organizations')}</TabsTrigger>
      <TabsTrigger value="following">{t('Following')}</TabsTrigger>
    </>
  );
};

export const DesktopOrganizationTabs = () => {
  const t = useTranslations();

  return (
    <>
      <TabsTrigger value="home">{t('Updates')}</TabsTrigger>
      <TabsTrigger value="relationships">{t('Relationships')}</TabsTrigger>
    </>
  );
};
