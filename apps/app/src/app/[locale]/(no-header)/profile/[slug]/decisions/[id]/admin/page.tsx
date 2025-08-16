import { trpcNext } from '@op/api/vanilla';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { AdminTransitionControls } from '@/components/decisions/AdminTransitionControls';

async function DecisionAdminPageContent({
  instanceId,
}: {
  instanceId: string;
}) {
  try {
    const client = await trpcNext();

    const instance = await client.decision.getInstance.query({
      instanceId,
    });

    if (!instance) {
      notFound();
    }

    const processSchema = instance.process?.processSchema as any;
    const phases = processSchema?.states || [];

    return (
      <div className="min-h-full bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Controls
            </h1>
            <p className="mt-2 text-gray-600">
              Manage transitions for: {instance.process?.name || instance.name}
            </p>
          </div>

          <div className="rounded-lg bg-white p-8 shadow-sm">
            <AdminTransitionControls
              instanceId={instanceId}
              currentStateId={instance.currentStateId || ''}
              phases={phases}
              transitions={processSchema?.transitions || []}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading decision admin page:', error);
    notFound();
  }
}

function DecisionAdminPageLoading() {
  return (
    <div className="min-h-full bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="h-8 w-64 animate-pulse rounded bg-neutral-gray1" />
          <div className="mt-2 h-6 w-96 animate-pulse rounded bg-neutral-gray1" />
        </div>

        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-neutral-gray1" />
            <div className="h-12 w-full animate-pulse rounded bg-neutral-gray1" />
            <div className="h-10 w-32 animate-pulse rounded bg-neutral-gray1" />
          </div>
        </div>
      </div>
    </div>
  );
}

const DecisionAdminPage = async ({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) => {
  const { id } = await params;

  return (
    <Suspense fallback={<DecisionAdminPageLoading />}>
      <DecisionAdminPageContent instanceId={id} />
    </Suspense>
  );
};

export default DecisionAdminPage;