import { getUser } from '@/utils/getUser';
import { ProcessStatus } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { isServerFeatureEnabled } from '@op/common';
import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';

import { getTranslations } from '@/lib/i18n';

import { NewProcessAdminBanner } from '@/components/decisions/ProcessBuilder/NewProcessAdminBanner';
import { ProcessBuilderAutosaveProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { ProcessBuilderEditArea } from '@/components/decisions/ProcessBuilder/ProcessBuilderEditArea';
import { ProcessBuilderFooter } from '@/components/decisions/ProcessBuilder/ProcessBuilderFooter';
import { ProcessBuilderMobileNav } from '@/components/decisions/ProcessBuilder/ProcessBuilderMobileNav';
import { ProcessBuilderShell } from '@/components/decisions/ProcessBuilder/ProcessBuilderShell';
import { ProcessBuilderStoreInitializer } from '@/components/decisions/ProcessBuilder/ProcessBuilderStoreInitializer';
import type { ProcessBuilderInstanceData } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

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
    return decisionProfile?.name
      ? {
          title: `${decisionProfile.name} (${t('decisions.editingPageTitle')})`,
        }
      : {};
  } catch {
    return {};
  }
}

const EditDecisionPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const client = await createClient();
  const { slug } = await params;

  // Get the decision profile to find the instance ID
  const decisionProfile = await client.decision.getDecisionBySlug({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  if (!decisionProfile.processInstance.access?.admin) {
    forbidden();
  }

  const { processInstance } = decisionProfile;
  const instanceId = processInstance.id;
  const instanceData =
    processInstance.instanceData as ProcessBuilderInstanceData;

  // Seed the store with server data so validation works immediately.
  const serverData: ProcessBuilderInstanceData = {
    name: decisionProfile.name ?? undefined,
    description: processInstance.description ?? undefined,
    stewardProfileId: processInstance.steward?.id,
    phases: instanceData.phases,
    proposalTemplate: instanceData.proposalTemplate,
    rubricTemplate: instanceData.rubricTemplate,
    config: instanceData.config,
  };

  const isDraft = processInstance.status === ProcessStatus.DRAFT;

  const user = await getUser();
  const isNewProcessAdminEnabled = user
    ? await isServerFeatureEnabled('new_process_admin_enabled', user.authUserId)
    : false;

  return (
    <ProcessBuilderShell>
      <ProcessBuilderAutosaveProvider
        decisionProfileId={decisionProfile.id}
        instanceId={instanceId}
        isDraft={isDraft}
      >
        <div className="relative flex h-dvh w-full flex-1 flex-col overflow-y-hidden bg-background">
          <ProcessBuilderStoreInitializer
            decisionProfileId={decisionProfile.id}
            serverData={serverData}
          />
          {isNewProcessAdminEnabled && <NewProcessAdminBanner slug={slug} />}
          <ProcessBuilderMobileNav instanceId={instanceId} slug={slug} />
          <ProcessBuilderEditArea
            decisionProfileId={decisionProfile.id}
            instanceId={instanceId}
            decisionName={decisionProfile.name}
          />
          <ProcessBuilderFooter
            instanceId={instanceId}
            slug={slug}
            decisionProfileId={decisionProfile.id}
          />
        </div>
      </ProcessBuilderAutosaveProvider>
    </ProcessBuilderShell>
  );
};

export default EditDecisionPage;
