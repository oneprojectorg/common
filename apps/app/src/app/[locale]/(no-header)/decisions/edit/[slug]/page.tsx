'use client';

import { trpc } from '@op/api/client';
import { SidebarLayout } from '@op/ui/Sidebar';
import { notFound, useParams } from 'next/navigation';

import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderProvider';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSidebar';
import { type NavigationConfig } from '@/components/decisions/ProcessBuilder/navigation-config';

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
      <ProcessBuilderHeader />
      <SidebarLayout>
        <ProcessBuilderSidebar />
        <div className="flex-1 p-8">
          {/* Main content area - will show section content based on query param */}
          <h2>Editing: {decisionProfile.name}</h2>
          {/* TODO: Add section-specific content components */}
        </div>
      </SidebarLayout>
    </ProcessBuilderProvider>
  );
};

export default EditDecisionPage;
