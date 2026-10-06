import { Header1 } from '@op/sense/Header';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations, useTranslations } from '@/lib/i18n';

import { AllDecisions } from '@/components/decisions/AllDecisions';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export const Route = createFileRoute('/$locale/_main/decisions/')({
  loader: async ({ params }) => {
    const t = await getTranslations({ locale: params.locale });

    return { title: t('decisions.decisionsLabel') };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  component: DecisionsListingPage,
});

function DecisionsListingPage() {
  const t = useTranslations();

  return (
    <ListPageLayout className="max-w-none gap-4 pt-8 sm:gap-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <Header1 className="text-headline">
          {t('shell.decisionsPageTitle')}
        </Header1>
        <p>{t('shell.decisionsPageSubtitle')}</p>
      </div>
      <AllDecisions />
    </ListPageLayout>
  );
}
