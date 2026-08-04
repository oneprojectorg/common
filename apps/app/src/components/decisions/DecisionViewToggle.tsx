'use client';

import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { useSelectedLayoutSegment } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';

interface DecisionViewToggleProps {
  /** Decision profile slug, used to build the two destination hrefs. */
  decisionSlug: string;
}

/**
 * Segmented Overview / Current Phase switch shown in the decision header.
 * Each segment is a route link, so the toggle anchors the user as they move
 * between /decisions/[slug] and /decisions/[slug]/current. The active
 * segment comes from the router (the child segment under the shared layout),
 * so the toggle needs no per-page prop telling it which tab is active.
 */
export function DecisionViewToggle({ decisionSlug }: DecisionViewToggleProps) {
  const t = useTranslations();
  const segment = useSelectedLayoutSegment();
  const activeView = segment === 'current' ? 'current' : 'overview';

  return (
    <Tabs value={activeView}>
      <TabsList>
        <TabsTrigger
          value="overview"
          className="font-normal hover:no-underline"
          render={<Link href={`/decisions/${decisionSlug}`} />}
        >
          {t('Overview')}
        </TabsTrigger>
        <TabsTrigger
          value="current"
          className="font-normal hover:no-underline"
          render={<Link href={`/decisions/${decisionSlug}/current`} />}
        >
          {t('Current Phase')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
