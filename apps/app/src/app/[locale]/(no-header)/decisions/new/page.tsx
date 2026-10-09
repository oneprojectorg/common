import { getRequiredUser } from '@/utils/getUser';
import { isServerFeatureEnabled } from '@op/common';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getTranslations } from '@/lib/i18n';

import { CreateProcessFlow } from '@/components/decisions/CreateProcessWizard/CreateProcessFlow';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'decisions.createWizard',
  });

  return { title: t('pageTitle') };
}

const NewDecisionProcessPage = async () => {
  const user = await getRequiredUser();

  const isEnabled = await isServerFeatureEnabled(
    'new_process_admin_enabled',
    user.authUserId,
  );

  if (!isEnabled) {
    notFound();
  }

  return <CreateProcessFlow />;
};

export default NewDecisionProcessPage;
