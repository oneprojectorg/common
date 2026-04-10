import { ProcessStatus } from '@op/api/encoders';
import { createClient } from '@op/api/serverClient';
import { forbidden, notFound } from 'next/navigation';

import { ProcessBuilderAutosaveProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { ProcessBuilderContent } from '@/components/decisions/ProcessBuilder/ProcessBuilderContent';
import { ProcessBuilderFooter } from '@/components/decisions/ProcessBuilder/ProcessBuilderFooter';
import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSectionNav';
import { ProcessBuilderShell } from '@/components/decisions/ProcessBuilder/ProcessBuilderShell';
import { ProcessBuilderStoreInitializer } from '@/components/decisions/ProcessBuilder/ProcessBuilderStoreInitializer';
import type { ProcessBuilderInstanceData } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

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
  const instanceData = processInstance.instanceData;

  // Seed the store with server data so validation works immediately.
  const serverData: ProcessBuilderInstanceData = {
    name: decisionProfile.name ?? undefined,
    description: processInstance.description ?? undefined,
    stewardProfileId: processInstance.steward?.id,
    phases: instanceData.phases,
    proposalTemplate:
      instanceData.proposalTemplate as ProcessBuilderInstanceData['proposalTemplate'],
    config: instanceData.config,
  };

  const isDraft = processInstance.status === ProcessStatus.DRAFT;

  return (
    <ProcessBuilderShell>
      <ProcessBuilderAutosaveProvider
        decisionProfileId={decisionProfile.id}
        instanceId={instanceId}
        isDraft={isDraft}
      >
        <div className="bg-background relative flex h-dvh w-full flex-1 flex-col overflow-y-hidden">
          <ProcessBuilderStoreInitializer
            decisionProfileId={decisionProfile.id}
            serverData={serverData}
            isDraft={isDraft}
          />
          <ProcessBuilderHeader instanceId={instanceId} slug={slug} />
          <div className="flex min-h-0 grow flex-col overflow-y-auto md:flex-row md:overflow-y-hidden">
            <ProcessBuilderSidebar
              instanceId={instanceId}
              decisionProfileId={decisionProfile.id}
            />
            <main className="h-full grow overflow-y-auto">
              <ProcessBuilderContent
                decisionProfileId={decisionProfile.id}
                instanceId={instanceId}
                decisionName={decisionProfile.name}
              />
            </main>
          </div>
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
