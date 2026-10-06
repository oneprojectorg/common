import { getDecisionEditor } from '@/server/decisions.functions';
import { Skeleton } from '@op/sense/Skeleton';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';

import { parseDecisionEditor } from '@/lib/decisionView';
import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { ProcessBuilderAutosaveProvider } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { ProcessBuilderEditArea } from '@/components/decisions/ProcessBuilder/ProcessBuilderEditArea';
import { ProcessBuilderFooter } from '@/components/decisions/ProcessBuilder/ProcessBuilderFooter';
import { ProcessBuilderMobileNav } from '@/components/decisions/ProcessBuilder/ProcessBuilderMobileNav';
import { ProcessBuilderShell } from '@/components/decisions/ProcessBuilder/ProcessBuilderShell';
import { ProcessBuilderStoreInitializer } from '@/components/decisions/ProcessBuilder/ProcessBuilderStoreInitializer';

export const Route = createFileRoute('/$locale/_noHeader/decisions/$slug/edit')(
  {
    loader: async ({ params }) => {
      const [editor, t] = await Promise.all([
        getDecisionEditor({ data: { slug: params.slug } }),
        getTranslations({ locale: params.locale }),
      ]);
      const { decisionName } = parseDecisionEditor(editor);

      return {
        editor,
        title: decisionName
          ? `${decisionName} (${t('decisions.editingPageTitle')})`
          : null,
      };
    },
    head: ({ loaderData }) => ({
      meta: loaderData?.title ? [pageTitle(loaderData.title)] : [],
    }),
    pendingComponent: EditDecisionLoading,
    component: EditDecisionPage,
  },
);

function EditDecisionPage() {
  const { slug } = Route.useParams();
  const { editor } = Route.useLoaderData();
  const { decisionProfileId, decisionName, instanceId, isDraft, serverData } =
    useMemo(() => parseDecisionEditor(editor), [editor]);

  return (
    <ProcessBuilderShell>
      <ProcessBuilderAutosaveProvider
        decisionProfileId={decisionProfileId}
        instanceId={instanceId}
        isDraft={isDraft}
      >
        <div className="relative flex h-dvh w-full flex-1 flex-col overflow-y-hidden bg-background">
          <ProcessBuilderStoreInitializer
            decisionProfileId={decisionProfileId}
            serverData={serverData}
          />
          <ProcessBuilderMobileNav instanceId={instanceId} slug={slug} />
          <ProcessBuilderEditArea
            decisionProfileId={decisionProfileId}
            instanceId={instanceId}
            decisionName={decisionName}
          />
          <ProcessBuilderFooter
            instanceId={instanceId}
            slug={slug}
            decisionProfileId={decisionProfileId}
          />
        </div>
      </ProcessBuilderAutosaveProvider>
    </ProcessBuilderShell>
  );
}

function EditDecisionLoading() {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="h-14 w-full" />
      <div className="flex flex-1">
        <Skeleton className="h-full w-64" />
        <Skeleton className="h-full flex-1" />
      </div>
    </div>
  );
}
