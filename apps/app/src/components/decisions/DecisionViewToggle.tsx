import { Tabs, TabsList, TabsTrigger } from '@op/sense/Tabs';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n/routing';
import { usePathname } from '@/lib/navigation';

/** The router's pathname — a vanity URL already rewritten to `/decisions/…`. */
const CURRENT_VIEW_PATH = /\/decisions\/[^/]+\/current(\/|$)/;

interface DecisionViewToggleProps {
  /** Decision profile slug, used to build the two destination hrefs. */
  decisionSlug: string;
}

/**
 * Segmented Overview / Current Phase switch shown in the decision header.
 * Each segment is a route link, so the toggle anchors the user as they move
 * between /decisions/[slug] and /decisions/[slug]/current. The active
 * segment comes from the router (the segment after the decision slug), so the
 * toggle needs no per-page prop telling it which tab is active.
 */
export function DecisionViewToggle({ decisionSlug }: DecisionViewToggleProps) {
  const t = useTranslations('decisions');
  const pathname = usePathname();
  const activeView = CURRENT_VIEW_PATH.test(pathname) ? 'current' : 'overview';

  return (
    <Tabs value={activeView}>
      <TabsList>
        {/* nativeButton={false}: each tab renders an <a>, not a <button>, so
            base-ui must skip the native-button semantics (and the invalid
            type="button" it would otherwise put on the anchor). */}
        <TabsTrigger
          value="overview"
          nativeButton={false}
          className="hover:no-underline"
          render={<Link href={`/decisions/${decisionSlug}`} />}
        >
          {t('overviewTab')}
        </TabsTrigger>
        <TabsTrigger
          value="current"
          nativeButton={false}
          className="hover:no-underline"
          render={<Link href={`/decisions/${decisionSlug}/current`} />}
        >
          {t('currentPhaseLabel')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
