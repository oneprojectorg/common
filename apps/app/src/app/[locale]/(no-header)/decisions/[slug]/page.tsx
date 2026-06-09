import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import { createClient } from '@op/api/serverClient';
import { CommonError } from '@op/common';
import { createSBServerClient } from '@op/supabase/server';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { forbidden, notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionHeader } from '@/components/decisions/DecisionHeader';
import { DecisionSidePanel } from '@/components/decisions/DecisionSidePanel';
import { DecisionStateRouter } from '@/components/decisions/DecisionStateRouter';
import { DecisionContentSkeleton } from '@/components/skeletons/DecisionSkeleton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [client, t] = await Promise.all([
      createClient(),
      getTranslations({ locale }),
    ]);
    const decisionProfile = await client.decision.getDecisionBySlug({ slug });
    const name = decisionProfile?.name || t('Decision');
    const steward = decisionProfile?.processInstance?.owner?.name;

    return { title: steward ? `${name} | ${steward}` : name };
  } catch {
    return {};
  }
}

const DecisionPageContent = async ({
  slug,
  locale,
}: {
  slug: string;
  locale: string;
}) => {
  const [client, { utils, queryClient }] = await Promise.all([
    createClient(),
    createServerUtils(),
  ]);

  let decisionProfile;
  try {
    decisionProfile = await client.decision.getDecisionBySlug({
      slug,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (cause instanceof CommonError && cause.statusCode === 403) {
      // Private decision. A session-less visitor may just need to log in to
      // gain access, so send them to /login with the path preserved. A caller
      // who already has a session (real or anonymous) but still lacks access
      // gets a forbidden page.
      const supabase = await createSBServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        redirect(
          `/login?redirect=${encodeURIComponent(`/${locale}/decisions/${slug}`)}`,
        );
      }

      forbidden();
    }
    if (cause instanceof CommonError && cause.statusCode === 404) {
      notFound();
    }
    throw error;
  }

  if (!decisionProfile || !decisionProfile.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;
  const ownerSlug = decisionProfile.processInstance.owner?.slug;

  if (!ownerSlug) {
    notFound();
  }

  // Prefetch the instance so the client-side useSuspenseQuery in
  // DecisionHeader and DecisionStateRouter resolves synchronously on hydration
  // (no skeleton flicker) — the two suspense reads share this cached entry.
  await utils.decision.getInstance.prefetch({ instanceId });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DecisionHeader
        instanceId={instanceId}
        decisionSlug={slug}
        isAdmin={decisionProfile.processInstance.access?.admin}
        canReadUpdates={
          decisionProfile.processInstance.access?.admin === true ||
          decisionProfile.processInstance.access?.read === true
        }
        profileName={decisionProfile.name}
      >
        <Suspense fallback={<DecisionContentSkeleton />}>
          <DecisionStateRouter
            instanceId={instanceId}
            slug={ownerSlug}
            decisionSlug={slug}
            decisionProfileId={decisionProfile.id}
          />
        </Suspense>
        <DecisionSidePanel
          decisionProfileId={decisionProfile.id}
          access={decisionProfile.processInstance.access}
        />
      </DecisionHeader>
    </HydrationBoundary>
  );
};

const DecisionPage = async ({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) => {
  const { slug, locale } = await params;

  return <DecisionPageContent slug={slug} locale={locale} />;
};

export default DecisionPage;
