'use client';

import { Tabs } from '@op/ui/Tabs';
import { useSearchParams } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';

import { usePathname } from '@/lib/i18n';

export const ProfileTabsWithQuery = ({
  children,
  className,
  initialTab,
  defaultTab,
  validTabs,
}: {
  children: ReactNode;
  className?: string;
  initialTab?: string;
  defaultTab: string;
  validTabs: string[];
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Determine the current selected tab from URL or fallback to initial/default
  const getCurrentSelectedTab = useCallback(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && validTabs.includes(currentTab)) {
      return currentTab;
    }
    if (initialTab && validTabs.includes(initialTab)) {
      return initialTab;
    }
    return defaultTab;
  }, [searchParams, initialTab, defaultTab, validTabs]);

  const [selectedKey, setSelectedKey] = useState<string>(
    getCurrentSelectedTab(),
  );

  // Track when we're programmatically updating the URL to prevent race conditions
  const isUpdatingUrlRef = useRef(false);

  // Update selected tab when URL changes (but not when we're the ones changing it)
  useEffect(() => {
    if (!isUpdatingUrlRef.current) {
      const newTab = getCurrentSelectedTab();
      setSelectedKey(newTab);
    }
  }, [getCurrentSelectedTab]);

  const handleSelectionChange = useCallback(
    (key: Key) => {
      const keyString = String(key);
      setSelectedKey(keyString);

      // Set flag to prevent the useEffect from reacting to our URL change
      isUpdatingUrlRef.current = true;

      // Create new URLSearchParams from current search params
      const newSearchParams = new URLSearchParams(searchParams.toString());

      if (keyString === defaultTab) {
        // Remove tab param for default tab to keep URL clean
        newSearchParams.delete('tab');
      } else {
        // Set tab param for non-default tabs
        newSearchParams.set('tab', keyString);
      }

      // Build the new URL
      const newUrl = newSearchParams.toString()
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname;

      // Use browser history API directly to avoid triggering Next.js router race conditions
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', newUrl);
      }

      // Reset flag immediately since we're using the browser API directly
      isUpdatingUrlRef.current = false;
    },
    [pathname, searchParams, defaultTab],
  );

  return (
    <Tabs
      className={className}
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}
    >
      {children}
    </Tabs>
  );
};
