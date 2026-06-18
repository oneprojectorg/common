import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { DecisionOverviewSuspense } from '@/components/decisions/DecisionOverview';
import { RichTextRenderer } from '@/components/decisions/RichTextRenderer';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

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
  const { instanceId } = await loadDecision(slug);

  // Render the overview body on the server (RSC) from its TipTap JSON, so the
  // prose ships as HTML with no client JS (only embed leaves are client
  // islands). Best-effort: on failure the slot is null and the client query +
  // error boundary in DecisionOverviewSuspense still drive the page.
  let aboutSlot: ReactNode = null;
  try {
    const client = await createClient();
    const instance = await client.decision.getInstance({ instanceId });
    const body = instance.instanceData?.overview?.body;
    if (body) {
      aboutSlot = <RichTextRenderer content={body} />;
    }
  } catch {
    aboutSlot = null;
  }

  return (
    <Suspense fallback={<DecisionContentSkeleton />}>
      <DecisionOverviewSuspense
        instanceId={instanceId}
        decisionSlug={slug}
        aboutSlot={aboutSlot}
      />
    </Suspense>
  );
};

export default DecisionOverviewPage;
