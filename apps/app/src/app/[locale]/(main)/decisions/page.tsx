import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { AllDecisions } from '@/components/decisions/AllDecisions';
import { ListPageLayout } from '@/components/layout/ListPageLayout';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('Decisions') };
}

const DecisionsListingPage = async () => {
  const t = await getTranslations();

  return (
    <ListPageLayout className="max-w-none gap-4 pt-8 sm:gap-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <Header1 className="text-headline">
          {t('Decision-making processes')}
        </Header1>
        <p>{t('Discover new ways to collectively decide together.')}</p>
      </div>
      <AllDecisions />
    </ListPageLayout>
  );
};

export default DecisionsListingPage;
