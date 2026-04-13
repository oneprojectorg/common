import { createClient } from '@op/api/serverClient';
import { forbidden, notFound } from 'next/navigation';

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
  const { instanceData } = processInstance;

  // Seed the store from draftInstanceData (the editable version).
  // Falls back to instanceData for instances that predate the migration.
  const draft = processInstance.draftInstanceData;
  const serverData: ProcessBuilderInstanceData = {
    name: draft?.name ?? decisionProfile.name ?? undefined,
    description: draft?.description ?? processInstance.description ?? undefined,
    stewardProfileId: draft?.stewardProfileId ?? processInstance.steward?.id,
    phases: draft?.phases ?? instanceData.phases,
    proposalTemplate: (draft?.proposalTemplate ??
      instanceData.proposalTemplate) as ProcessBuilderInstanceData['proposalTemplate'],
    config: draft?.config ?? instanceData.config,
  };

  return (
    <ProcessBuilderShell>
      <div className="bg-background relative flex h-dvh w-full flex-1 flex-col overflow-y-hidden">
        <ProcessBuilderStoreInitializer
          decisionProfileId={decisionProfile.id}
          serverData={serverData}
          isDraft={processInstance.status === 'draft'}
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
    </ProcessBuilderShell>
  );
};

export default EditDecisionPage;
