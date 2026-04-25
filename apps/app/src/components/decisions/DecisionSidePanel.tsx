'use client';

import { Header2 } from '@op/ui/Header';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';

import { usePathname, useTranslations } from '@/lib/i18n';

const PANEL_TAB_QUERY_KEY = 'panelTab';
const VALID_PANEL_TABS = ['updates', 'meetings', 'resources'] as const;
const DEFAULT_PANEL_TAB: PanelTab = 'updates';

type PanelTab = (typeof VALID_PANEL_TABS)[number];

const isPanelTab = (value: string | null): value is PanelTab =>
  value !== null && (VALID_PANEL_TABS as readonly string[]).includes(value);

export const DecisionSidePanel = () => {
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getCurrentSelectedTab = useCallback((): PanelTab => {
    const currentTab = searchParams.get(PANEL_TAB_QUERY_KEY);
    if (isPanelTab(currentTab)) {
      return currentTab;
    }
    return DEFAULT_PANEL_TAB;
  }, [searchParams]);

  const [selectedKey, setSelectedKey] = useState<PanelTab>(
    getCurrentSelectedTab(),
  );

  const isUpdatingUrlRef = useRef(false);

  useEffect(() => {
    if (!isUpdatingUrlRef.current) {
      setSelectedKey(getCurrentSelectedTab());
    }
  }, [getCurrentSelectedTab]);

  const handleSelectionChange = useCallback(
    (key: Key) => {
      const keyString = String(key);
      if (!isPanelTab(keyString)) {
        return;
      }
      setSelectedKey(keyString);

      isUpdatingUrlRef.current = true;

      const newSearchParams = new URLSearchParams(searchParams.toString());
      if (keyString === DEFAULT_PANEL_TAB) {
        newSearchParams.delete(PANEL_TAB_QUERY_KEY);
      } else {
        newSearchParams.set(PANEL_TAB_QUERY_KEY, keyString);
      }

      const newUrl = newSearchParams.toString()
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname;

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', newUrl);
      }

      isUpdatingUrlRef.current = false;
    },
    [pathname, searchParams],
  );

  return (
    <aside className="hidden w-80 shrink-0 border-l border-neutral-gray2 bg-white lg:flex lg:flex-col">
      <Tabs
        selectedKey={selectedKey}
        onSelectionChange={handleSelectionChange}
        className="gap-0"
      >
        <TabList className="px-4 pt-4">
          <Tab id="updates">{t('Updates')}</Tab>
          <Tab id="meetings">{t('Meetings')}</Tab>
          <Tab id="resources">{t('Resources')}</Tab>
        </TabList>
        <TabPanel id="updates" className="px-4 py-4">
          <Header2 className="font-serif text-title-sm leading-normal">
            {t('Updates')}
          </Header2>
        </TabPanel>
        <TabPanel id="meetings" className="px-4 py-4 text-neutral-gray4">
          {t('Coming soon')}
        </TabPanel>
        <TabPanel id="resources" className="px-4 py-4 text-neutral-gray4">
          {t('Coming soon')}
        </TabPanel>
      </Tabs>
    </aside>
  );
};
