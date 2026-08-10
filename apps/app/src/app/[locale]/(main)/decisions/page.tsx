import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { TranslatedText } from '@/components/TranslatedText';
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

const DecisionsListingPage = () => {
  return (
    <ListPageLayout className="max-w-none gap-4 pt-8 sm:gap-6 sm:pt-12">
      <div className="flex flex-col gap-2">
        <Header1 className="text-headline">
          <TranslatedText text="Decision-making processes" />
        </Header1>
        <p className="text-foreground">
          <TranslatedText text="Discover new ways to collectively decide together." />
        </p>
      </div>
      <AllDecisions />
    </ListPageLayout>
  );
};

export default DecisionsListingPage;
