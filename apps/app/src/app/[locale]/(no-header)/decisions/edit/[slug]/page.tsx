import { createClient } from '@op/api/serverClient';
import { SidebarLayout } from '@op/ui/Sidebar';
import { notFound } from 'next/navigation';

import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderProvider';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSidebar';

const EditDecisionPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const client = await createClient();

  const decisionProfile = await client.decision.getDecisionBySlug({ slug });

  if (!decisionProfile || !decisionProfile.processInstance) {
    notFound();
  }

  return (
    <ProcessBuilderProvider>
      <ProcessBuilderHeader
        steps={[
          { id: 'overview', label: 'Overview' },
          { id: 'phases', label: 'Phases' },
          { id: 'categories', label: 'Categories' },
          { id: 'voting', label: 'Voting' },
        ]}
      />
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
