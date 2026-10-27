import {
  HydrationBoundary,
  createServerUtils,
  dehydrate,
} from '@op/api/server';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { ProcessAdminOverview } from '@/components/decisions/ProcessAdmin/ProcessAdminOverview';
import { getViewableOverviewBody } from '@/components/decisions/ProcessAdmin/getViewableOverviewBody';
import { isProcessOpen } from '@/components/decisions/ProcessAdmin/processAdminStatus';
import { RichTextRenderer } from '@/components/decisions/RichTextRenderer';

import { loadProcessAdmin } from '../loadProcessAdmin';

interface ManageDecisionPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: ManageDecisionPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const [{ decisionProfile }, t] = await Promise.all([
    loadProcessAdmin(slug),
    getTranslations({ locale, namespace: 'decisions.processAdmin' }),
  ]);

  return { title: t('pageTitle', { decisionName: decisionProfile.name }) };
}

const ManageDecisionPage = async ({ params }: ManageDecisionPageProps) => {
  const { slug } = await params;
  const { decisionProfile } = await loadProcessAdmin(slug);

  // Seed the cache with the gate's read so the overview renders without
  // suspending. The client still refetches it in the background once stale.
  const { utils, queryClient } = await createServerUtils();
  queryClient.setQueryData(
    utils.decision.getDecisionBySlug.queryOptions({ slug }).queryKey,
    decisionProfile,
  );

  const instance = decisionProfile.processInstance;
  const isOpen = isProcessOpen({
    status: instance.status,
    phases: instance.instanceData.phases,
  });

  // Same server render as the public page, so admins and participants see one
  // renderer and the body is in the HTML instead of appearing after hydration.
  const body = getViewableOverviewBody(instance.instanceData.overview?.body);
  const aboutSlot = body ? <RichTextRenderer content={body} /> : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProcessAdminOverview slug={slug} isOpen={isOpen} aboutSlot={aboutSlot} />
    </HydrationBoundary>
  );
};

export default ManageDecisionPage;
