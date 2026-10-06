import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { OrgsTable } from '@/components/screens/PlatformAdmin';
import { AdminLoading } from '@/components/screens/PlatformAdmin/AdminLoading';

export const Route = createFileRoute('/$locale/_main/admin/_dashboard/orgs/')({
  loader: async ({ params }) => {
    const t = await getTranslations({ locale: params.locale });

    return { title: `${t('Organizations')} | ${t('Admin')}` };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: AdminLoading,
  component: AdminOrgsPage,
});

function AdminOrgsPage() {
  return <OrgsTable />;
}
