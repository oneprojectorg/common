'use client';

import { ProcessBuilderHeader } from '@/components/decisions/ProcessBuilder/ProcessBuilderHeader';
import { trpc } from '@op/api/client';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Skeleton } from '@op/ui/Skeleton';

const CreateDecisionPage = () => {
  return (
    <div className="flex size-full flex-col">
      <ProcessBuilderHeader />
      <Suspense fallback={<CreateDecisionSkeleton />}>
        <AutoCreateDecision />
      </Suspense>
    </div>
  );
};

const AutoCreateDecision = () => {
  const router = useRouter();
  const [templatesData] = trpc.decision.listProcesses.useSuspenseQuery({});
  const templates = templatesData?.processes;

  const createDecisionInstance =
    trpc.decision.createInstanceFromTemplate.useMutation({
      onSuccess: (data) => {
        router.push(`/decisions/${data.slug}/edit`);
      },
    });

  useEffect(() => {
    if (
      templates &&
      templates.length > 0 &&
      !createDecisionInstance.isPending &&
      !createDecisionInstance.isSuccess
    ) {
      const firstTemplate = templates[0];
      if (firstTemplate) {
        createDecisionInstance.mutate({
          templateId: firstTemplate.id,
          name: `New ${firstTemplate.name}`,
        });
      }
    }
  }, [
    templates,
    createDecisionInstance.isPending,
    createDecisionInstance.isSuccess,
    createDecisionInstance.mutate,
  ]);

  return (
    <div className="size-full grow p-4 sm:p-8">
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto rounded-lg border bg-neutral-offWhite p-4 md:gap-8 md:p-8">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
};

const CreateDecisionSkeleton = () => {
  return (
    <div className="size-full grow p-4 sm:p-8">
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto rounded-lg border bg-neutral-offWhite p-4 md:gap-8 md:p-8">
        <Skeleton className="h-8 w-64" />
      </div>
    </div>
  );
};

export default CreateDecisionPage;
