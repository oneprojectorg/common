import { Header1 } from '@op/sense/Header';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { loadProcessAdmin } from '../loadProcessAdmin';

interface ManageDecisionPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: ManageDecisionPageProps): Promise<Metadata> {
  const { decisionProfile, t } = await loadPage(params);

  return { title: t('pageTitle', { decisionName: decisionProfile.name }) };
}

const ManageDecisionPage = async ({ params }: ManageDecisionPageProps) => {
  const { decisionProfile, t } = await loadPage(params);

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-background px-4 py-12 md:px-6">
      <Header1>{decisionProfile.name}</Header1>
      <p className="text-muted-foreground">{t('underConstruction')}</p>
    </main>
  );
};

export default ManageDecisionPage;

const loadPage = async (params: ManageDecisionPageProps['params']) => {
  const { slug, locale } = await params;
  const [{ decisionProfile }, t] = await Promise.all([
    loadProcessAdmin(slug),
    getTranslations({ locale, namespace: 'decisions.processAdmin' }),
  ]);

  return { decisionProfile, t };
};
