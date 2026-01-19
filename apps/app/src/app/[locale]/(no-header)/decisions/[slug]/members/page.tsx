import { createClient } from '@op/api/serverClient';
import { Skeleton } from '@op/ui/Skeleton';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { DecisionMembersHeader } from '@/components/decisions/DecisionMembersHeader';
import { DecisionMembersPage } from '@/components/decisions/DecisionMembersPage';

const DecisionMembersContent = async ({ slug }: { slug: string }) => {
  const client = await createClient();

  const decisionProfile = await client.decision.getDecisionBySlug({
    slug,
  });

  if (!decisionProfile || !decisionProfile.processInstance) {
    notFound();
  }

  const profileId = decisionProfile.id;
  const ownerSlug = decisionProfile.processInstance.owner?.slug;
  const decisionName =
    decisionProfile.processInstance.process?.name ||
    decisionProfile.processInstance.name;

  if (!ownerSlug) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-offWhite">
      <DecisionMembersHeader
        backTo={{
          label: decisionName,
          href: `/decisions/${slug}`,
        }}
        title="Members"
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <DecisionMembersPage profileId={profileId} />
        </Suspense>
      </div>
    </div>
  );
};

const MembersPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <DecisionMembersContent slug={slug} />;
};

export default MembersPage;
