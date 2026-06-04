'use client';

import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';

import { useTranslations } from '@/lib/i18n';
import { Link, usePathname } from '@/lib/i18n/routing';

interface DecisionViewToggleProps {
  /** Decision profile slug, used to build the two destination hrefs. */
  decisionSlug: string;
}

/**
 * Segmented Overview / Current Phase switch shown in the decision header.
 * Each segment is a route link, so the toggle anchors the user as they move
 * between /decisions/[slug] (overview) and /decisions/[slug]/current. The
 * active segment is derived from the path — the toggle lives in the shared
 * layout, so it has no per-page prop telling it which tab is active.
 */
export function DecisionViewToggle({ decisionSlug }: DecisionViewToggleProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const activeView =
    pathname.split('/').pop() === 'current' ? 'current' : 'overview';

  return (
    <Tabs value={activeView}>
      <TabsList>
        <TabsTrigger
          value="overview"
          render={
            <Link
              className="hover:no-underline"
              href={`/decisions/${decisionSlug}/overview`}
            />
          }
        >
          {t('Overview')}
        </TabsTrigger>
        <TabsTrigger
          value="current"
          render={
            <Link
              className="hover:no-underline"
              href={`/decisions/${decisionSlug}/current`}
            />
          }
        >
          {t('Current Phase')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
