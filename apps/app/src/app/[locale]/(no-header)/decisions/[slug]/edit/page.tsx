import { createClient } from '@op/api/serverClient';
import { notFound } from 'next/navigation';

import { ProcessBuilderContent } from '@/components/decisions/ProcessBuilder/ProcessBuilderContent';
import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSectionNav';

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

  const instanceId = decisionProfile.processInstance.id;

  return (
    <div className="bg-background relative flex size-full flex-1 flex-col">
      <ProcessBuilderHeader
        processName={decisionProfile.name}
        instanceId={instanceId}
      />
      <div className="flex grow flex-col overflow-y-auto sm:flex-row">
        <ProcessBuilderSidebar instanceId={instanceId} />
        <main className="grow">
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
