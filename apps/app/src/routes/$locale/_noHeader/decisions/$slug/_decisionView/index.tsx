import { OPURLConfig, getTextPreview } from '@op/core';
import { createFileRoute } from '@tanstack/react-router';

import { decisionOgImageMeta } from '@/lib/decisionOgImage';
import { parseDecisionView, useDecisionView } from '@/lib/decisionView';
import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { DecisionOverview } from '@/components/decisions/DecisionOverview';
import { RichTextRenderer } from '@/components/decisions/RichTextRenderer';
import { hasFirstPhaseStarted } from '@/components/decisions/hasFirstPhaseStarted';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

/**
 * Decision overview — the canonical decision page at /decisions/$slug. The
 * shared header + Overview/Current Phase toggle come from the _decisionView
 * layout; this renders the overview content.
 *
 * Single fetch: everything the overview renders (body, phases, headline,
 * access) comes from the layout's decision fetch (getDecisionBySlug, which the
 * router enriches with `access` + encoded `instanceData`). No separate
 * `getInstance` call — the content + per-user access ride on the one slug fetch
 * the route already makes. The client components read this via props, so
 * there's no client `getInstance` query on this route either.
 */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/_decisionView/',
)({
  loader: async ({ params, parentMatchPromise }) => {
    const [{ loaderData }, t] = await Promise.all([
      parentMatchPromise,
      getTranslations({ locale: params.locale }),
    ]);

    if (!loaderData) {
      return null;
    }

    const { decisionProfile } = parseDecisionView(loaderData);
    const name = decisionProfile.name || t('decisions.decisionLabel');
    const steward = decisionProfile.processInstance?.steward?.name;
    const description =
      getTextPreview({
        content: decisionProfile.bio ?? decisionProfile.mission ?? '',
        maxLines: 3,
        maxLength: 155,
      }) || undefined;

    return {
      title: steward ? `${name} | ${steward}` : name,
      name,
      description,
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {};
    }

    const { title, name, description } = loaderData;

    return {
      meta: [
        pageTitle(title),
        ...(description ? [{ name: 'description', content: description }] : []),
        // robots is set only here, on the publicly-readable page, and only in
        // production — staging/preview keep the global noindex from the root
        // route, as does a private decision (its loader throws, so this head
        // never runs). googlebot is restated because the root names it too.
        ...(OPURLConfig('APP').IS_PRODUCTION
          ? [
              { name: 'robots', content: 'index, follow' },
              { name: 'googlebot', content: 'index, follow' },
            ]
          : []),
        { property: 'og:title', content: name },
        ...(description
          ? [{ property: 'og:description', content: description }]
          : []),
        { property: 'og:type', content: 'article' },
        ...decisionOgImageMeta(`/${params.locale}/decisions/${params.slug}`),
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: name },
        ...(description
          ? [{ name: 'twitter:description', content: description }]
          : []),
      ],
    };
  },
  pendingComponent: DecisionOverviewLoading,
  component: DecisionOverviewPage,
});

function DecisionOverviewPage() {
  const { slug } = Route.useParams();
  const { decisionProfile, instanceId } = useDecisionView();
  const instance = decisionProfile.processInstance;

  // The "About" body renders from the overview's rich-text content. Null when
  // there's no body (falls back to the plain description in OverviewAbout).
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
}

// This pending state belongs to the overview tab; the header + tabs live in the
// persisted layout, so only the swapping content skeletons. /current has its
// own with the proposal-list shape.
function DecisionOverviewLoading() {
  return <DecisionContentSkeleton />;
}
