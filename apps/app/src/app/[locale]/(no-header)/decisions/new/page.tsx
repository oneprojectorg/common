import { getRequiredUser } from '@/utils/getUser';
import { NEW_PROCESS_ADMIN_FLAG, isServerFeatureEnabled } from '@op/common';
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
  // Creating a process is admin work; a visitor with no session gets login.
  const user = await getRequiredUser();

  // The Create menu hides its entry behind the same flag. Without this the
  // route would be reachable by URL with the flag off, gating the menu item
  // rather than the feature.
  const isEnabled = await isServerFeatureEnabled(
    NEW_PROCESS_ADMIN_FLAG,
    user.authUserId,
  );

  if (!isEnabled) {
    notFound();
  }

  return <CreateProcessFlow />;
};

export default NewDecisionProcessPage;
