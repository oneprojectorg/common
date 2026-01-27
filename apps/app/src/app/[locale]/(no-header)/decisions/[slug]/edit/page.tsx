import { createClient } from '@op/api/serverClient';
import { notFound } from 'next/navigation';

import { ProcessBuilderContent } from '@/components/decisions/ProcessBuilder/ProcessBuilderContent';
import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSectionNav';
import {
  DEFAULT_NAVIGATION_CONFIG,
  type NavigationConfig,
} from '@/components/decisions/ProcessBuilder/navigationConfig';

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

  // TODO: Get navigation config from process instance or process type
  const navigationConfig: NavigationConfig = DEFAULT_NAVIGATION_CONFIG;

  return (
    <div className="bg-background relative flex size-full flex-1 flex-col">
      <ProcessBuilderHeader
        processName={decisionProfile.name}
        navigationConfig={navigationConfig}
      />
      <div className="flex grow flex-col overflow-y-auto sm:flex-row">
        <ProcessBuilderSidebar navigationConfig={navigationConfig} />
        <main className="grow">
          <ProcessBuilderContent
            decisionProfileId={decisionProfile.id}
            decisionName={decisionProfile.name}
            navigationConfig={navigationConfig}
          />
        </main>
      </div>
    </div>
  );
};

export default EditDecisionPage;
