'use client';

import { trpc } from '@op/api/client';
import { SidebarLayout } from '@op/ui/Sidebar';
import { notFound, useParams } from 'next/navigation';

import { ProcessBuilderContent } from '@/components/decisions/ProcessBuilder/ProcessBuilderContent';
import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderProvider';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSidebar';
import { type NavigationConfig } from '@/components/decisions/ProcessBuilder/navigationConfig';

const EditDecisionPage = () => {
  const { slug } = useParams<{ slug: string }>();

  // Get the decision profile to find the instance ID
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  // TODO: Get navigation config from process instance or process type
  // For now, show all steps and sections (empty config = all visible)
  const navigationConfig: NavigationConfig = {};

  return (
    <ProcessBuilderProvider navigationConfig={navigationConfig}>
      <ProcessBuilderHeader processName={decisionProfile.name} />
      <SidebarLayout>
        <ProcessBuilderSidebar />
        <main className="flex-1 p-8">
          <ProcessBuilderContent
            decisionId={decisionProfile.id}
            decisionName={decisionProfile.name}
          />
        </main>
      </SidebarLayout>
    </ProcessBuilderProvider>
  );
};

export default EditDecisionPage;
