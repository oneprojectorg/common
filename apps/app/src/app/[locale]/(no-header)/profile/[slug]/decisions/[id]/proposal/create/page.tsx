import { createClient } from '@op/api/serverClient';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProposalEditor } from '@/components/decisions/ProposalEditor';

export const dynamic = 'force-dynamic';

async function CreateProposalPageContent({
  instanceId,
  slug,
}: {
  instanceId: string;
  slug: string;
}) {
  try {
    const client = await createClient();
    const instance = await client.decision.getInstance({
      instanceId,
    });

    if (!instance) {
      notFound();
    }

    return (
      <ProposalEditor
        instance={instance}
        backHref={`/profile/${slug}/decisions/${instanceId}`}
      />
    );
  } catch (error) {
    console.error('Error loading decision instance:', error);
    notFound();
  }
}

function CreateProposalPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header loading */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Toolbar loading */}
      <div className="border-b bg-white px-6 py-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-8 w-8 animate-pulse rounded bg-gray-200"
            />
          ))}
        </div>
      </div>

      {/* Content loading */}
      <div className="flex-1 bg-white px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-12 w-64 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-4">
            <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

const CreateProposalPage = async ({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) => {
  const { id, slug } = await params;

  return (
    <Suspense fallback={<CreateProposalPageSkeleton />}>
      <CreateProposalPageContent instanceId={id} slug={slug} />
    </Suspense>
  );
};

export default CreateProposalPage;
