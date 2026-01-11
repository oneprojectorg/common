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
      <div className="px-6 py-4 flex items-center justify-between border-b border-neutral-gray1 bg-white">
        <div className="h-6 w-16 bg-gray-200 animate-pulse rounded" />
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
        <div className="gap-3 flex items-center">
          <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="h-8 w-8 bg-gray-200 animate-pulse rounded-full" />
        </div>
      </div>

      {/* Toolbar loading */}
      <div className="px-6 py-2 border-b border-neutral-gray1 bg-white">
        <div className="gap-2 flex items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-8 w-8 bg-gray-200 animate-pulse rounded"
            />
          ))}
        </div>
      </div>

      {/* Content loading */}
      <div className="px-6 py-8 flex-1 bg-white">
        <div className="max-w-4xl space-y-6 mx-auto">
          <div className="h-12 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="gap-4 flex">
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />
            <div className="h-8 w-28 bg-gray-200 animate-pulse rounded" />
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 animate-pulse w-full rounded" />
            <div className="h-4 bg-gray-200 animate-pulse w-3/4 rounded" />
            <div className="h-4 bg-gray-200 animate-pulse w-1/2 rounded" />
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
