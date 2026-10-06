import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { UsersTable } from '@/components/screens/PlatformAdmin';
import { AdminLoading } from '@/components/screens/PlatformAdmin/AdminLoading';

export const Route = createFileRoute('/$locale/_main/admin/_dashboard/users/')({
  loader: async ({ params }) => {
    const t = await getTranslations({ locale: params.locale });

    return { title: `${t('shell.usersNavTitle')} | ${t('Admin')}` };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: AdminLoading,
  component: AdminUsersPage,
});

function AdminUsersPage() {
  return <UsersTable />;
}
