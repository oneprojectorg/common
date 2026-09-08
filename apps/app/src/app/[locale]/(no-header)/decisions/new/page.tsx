import { getRequiredUser } from '@/utils/getUser';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { CreateProcessFlow } from '@/components/decisions/CreateProcessWizard/CreateProcessFlow';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return { title: t('New decision-making process') };
}

const NewDecisionProcessPage = async () => {
  // Creating a process is admin work; a visitor with no session gets login.
  await getRequiredUser();

  return <CreateProcessFlow />;
};

export default NewDecisionProcessPage;
