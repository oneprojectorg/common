import { getRequiredUser } from '@/utils/getUser';
import { isServerFeatureEnabled } from '@op/common';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getTranslations } from '@/lib/i18n';

import { CreateProcessFlow } from '@/components/decisions/CreateProcessWizard';

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

  // `decision.createInstance` admits only the closed network.
  if (!user.isNetworkMember) {
    notFound();
  }

  const isEnabled = await isServerFeatureEnabled({
    key: 'new_process_admin_enabled',
    distinctId: user.authUserId,
  });

  if (!isEnabled) {
    notFound();
  }

  return <CreateProcessFlow />;
};

export default NewDecisionProcessPage;
