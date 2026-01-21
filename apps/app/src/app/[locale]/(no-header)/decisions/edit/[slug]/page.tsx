'use client';

import { trpc } from '@op/api/client';
import { SidebarLayout } from '@op/ui/Sidebar';
import { notFound, useParams } from 'next/navigation';

import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { ProcessBuilderProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderProvider';
import { ProcessBuilderSidebar } from '@/components/decisions/ProcessBuilder/ProcessBuilderSidebar';

const EditDecisionPage = ({}: {}) => {
  const { slug } = useParams<{ slug: string }>();

  console.log(slug);

  // Get the decision profile to find the instance ID
  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;

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
