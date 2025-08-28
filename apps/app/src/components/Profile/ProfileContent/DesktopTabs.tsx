'use client';

import { Tab } from '@op/ui/Tabs';

import { useTranslations } from '@/lib/i18n';

export const DesktopIndividualTabs = () => {
  const t = useTranslations();
  
  return (
    <>
      <Tab id="about">{t('About')}</Tab>
      <Tab id="organizations">{t('Organizations')}</Tab>
      <Tab id="following">{t('Following')}</Tab>
    </>
  );
};

export const DesktopOrganizationTabs = () => {
  const t = useTranslations();
  
  return (
    <>
      <Tab id="home">{t('Updates')}</Tab>
      <Tab id="relationships">{t('Relationships')}</Tab>
    </>
  );
};