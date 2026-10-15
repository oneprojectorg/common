import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { UpdatesScreen } from '@/components/screens/UpdatesScreen';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('shell.updatesNavTitle') };
}

const UpdatesPage = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  return <UpdatesScreen locale={locale} />;
};

export default UpdatesPage;
