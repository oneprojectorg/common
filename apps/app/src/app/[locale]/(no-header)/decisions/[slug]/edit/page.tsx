import { createClient } from '@op/api/serverClient';
import { notFound } from 'next/navigation';

import { ProcessBuilderContent } from '@/components/decisions/ProcessBuilder/ProcessBuilderContent';
import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSectionNav';
import { ProcessBuilderStoreInitializer } from '@/components/decisions/ProcessBuilder/ProcessBuilderStoreInitializer';
import type { FormInstanceData } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';

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

  const { processInstance } = decisionProfile;
  const instanceId = processInstance.id;
  const instanceData = processInstance.instanceData;

  // Map server data into the shape the store expects so validation works
  // immediately — even before the user visits any section.
  const serverData: FormInstanceData = {
    name: processInstance.name ?? undefined,
    description: processInstance.description ?? undefined,
    stewardProfileId: processInstance.steward?.id,
    phases: instanceData.phases,
    proposalTemplate:
      instanceData.proposalTemplate as FormInstanceData['proposalTemplate'],
    hideBudget: instanceData.config?.hideBudget,
    categories: instanceData.config?.categories,
    requireCategorySelection: instanceData.config?.requireCategorySelection,
    allowMultipleCategories: instanceData.config?.allowMultipleCategories,
  };

  return (
    <div className="bg-background relative flex h-dvh w-full flex-1 flex-col">
      <ProcessBuilderStoreInitializer
        decisionProfileId={decisionProfile.id}
        serverData={serverData}
        isDraft={processInstance.status === 'draft'}
      />
      <ProcessBuilderHeader instanceId={instanceId} slug={slug} />
      <div className="flex min-h-0 grow flex-col overflow-y-auto md:flex-row md:overflow-y-hidden">
        <ProcessBuilderSidebar instanceId={instanceId} />
        <main className="h-full grow overflow-y-auto [scrollbar-gutter:stable]">
          <ProcessBuilderContent
            decisionProfileId={decisionProfile.id}
            instanceId={instanceId}
            decisionName={decisionProfile.name}
          />
        </main>
      </div>
    </div>
  );
};

export default EditDecisionPage;
