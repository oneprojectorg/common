import { getUser } from '@/utils/getUser';
import { assertWalledGardenAccess } from '@/utils/walledGarden';
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
  // (no-header) hosts public decision pages too, so the closed-network gate
  // sits on this page rather than in the layout. `decision.createInstance`
  // admits only the closed network.
  const user = await assertWalledGardenAccess(await getUser());

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
