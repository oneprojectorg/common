'use client';

import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

export type DecisionView = 'overview' | 'current';

interface DecisionViewToggleProps {
  /** Which view is currently active — drives the selected segment. */
  activeView: DecisionView;
  /** Decision profile slug, used to build the two destination hrefs. */
  decisionSlug: string;
}

/**
 * Segmented Overview / Current Phase switch shown in the decision header.
 * Each segment is a route link, so the toggle anchors the user as they move
 * between /decisions/[slug] (current phase) and /decisions/[slug]/overview.
 * The active segment is controlled by `activeView` — the page that renders
 * the header knows which view it is, so no client-side path matching needed.
 */
export function DecisionViewToggle({
  activeView,
  decisionSlug,
}: DecisionViewToggleProps) {
  const t = useTranslations();

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
              href={`/decisions/${decisionSlug}`}
            />
          }
        >
          {t('Current Phase')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
