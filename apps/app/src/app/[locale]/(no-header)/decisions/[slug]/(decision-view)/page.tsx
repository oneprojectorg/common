import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DecisionOverview } from '@/components/decisions/DecisionOverview';
import { RichTextRenderer } from '@/components/decisions/RichTextRenderer';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';

import { loadDecision } from './loadDecision';
import { truncateDescription } from './metaDescription';

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
    const name = decisionProfile.name || t('Decision');
    const steward = decisionProfile.processInstance?.steward?.name;
    const description = truncateDescription(
      decisionProfile.bio ?? decisionProfile.mission ?? '',
    );

    // robots is set only here, in the publicly-readable path: a private decision
    // throws in loadDecision and falls into the catch below, leaving the global
    // noindex from the root layout in place. The colocated opengraph-image route
    // supplies og:image for this page and its child phase routes.
    return {
      title: steward ? `${name} | ${steward}` : name,
      description: description || undefined,
      robots: { index: true, follow: true },
      openGraph: {
        title: name,
        description: description || undefined,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: name,
        description: description || undefined,
      },
    };
  } catch {
    return {};
  }
}

/**
 * Decision overview — the canonical decision page at /decisions/[slug]. The
 * shared header + Overview/Current Phase toggle come from the (decision-view)
 * layout; this renders the overview content.
 *
 * Single fetch: everything the overview renders (body, phases, headline,
 * access) comes from `loadDecision` (getDecisionBySlug, which the router
 * enriches with `access` + encoded `instanceData`). No separate `getInstance`
 * call — the content + per-user access ride on the one slug fetch the route
 * already makes. The client components read this via props, so there's no
 * client `getInstance` query on this route either.
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
