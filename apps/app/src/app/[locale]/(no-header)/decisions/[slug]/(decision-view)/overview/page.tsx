import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DecisionOverview } from '@/components/decisions/DecisionOverview';
import { RichTextRenderer } from '@/components/decisions/RichTextRenderer';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';

import { loadDecision } from '../loadDecision';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [{ decisionProfile }, t] = await Promise.all([
      loadDecision(slug),
      getTranslations({ locale }),
    ]);
    const label = t('Overview');
    return {
      title: decisionProfile.name
        ? `${label} | ${decisionProfile.name}`
        : label,
    };
  } catch {
    return {};
  }
}

/**
 * Overview tab (/decisions/[slug]/overview). The shared header + tabs come
 * from the (decision-view) layout; this only renders the overview content.
 *
 * Single fetch: everything the overview renders (body, phases, headline,
 * access) comes from `loadDecision` (getDecisionBySlug, which the router
 * enriches with `access` + encoded `instanceData`). No separate `getInstance`
 * call — the content + per-user access ride on the one slug fetch the route
 * already makes. The client components read this via props, so there's no
 * client `getInstance` query on this route either.
 *
 * Temporary home: while the overview ships behind a flag, the old
 * current-phase page stays canonical at /decisions/[slug]. When the overview
 * is ready it moves to the root and the old page is retired.
 */
const DecisionOverviewPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const { decisionProfile, instanceId } = await loadDecision(slug);
  const instance = decisionProfile.processInstance;

  // The "About" body ships as server HTML (no client JS) from the overview's
  // rich-text content. Null when there's no body (falls back to the plain
  // description in OverviewAbout).
  const body = instance.instanceData?.overview?.body;
  const aboutSlot = body ? <RichTextRenderer content={body} /> : null;

  // The process is "active" once its first phase begins; the proposal CTAs stay
  // hidden until then. Same gate as the view toggle in the layout.
  const isActive = hasFirstPhaseStarted(instance.instanceData?.phases);

  return (
    <DecisionOverview
      instanceId={instanceId}
      decisionSlug={slug}
      processInstance={instance}
      aboutSlot={aboutSlot}
      isActive={isActive}
    />
  );
};

export default DecisionOverviewPage;
