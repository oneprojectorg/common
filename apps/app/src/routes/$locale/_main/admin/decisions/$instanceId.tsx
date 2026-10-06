import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { DecisionInstanceDetail } from '@/components/screens/PlatformAdmin';
import { AdminLoading } from '@/components/screens/PlatformAdmin/AdminLoading';

export const Route = createFileRoute(
  '/$locale/_main/admin/decisions/$instanceId',
)({
  loader: async ({ params }) => {
    const t = await getTranslations({ locale: params.locale });

    return { title: `${t('decisions.decisionLabel')} | ${t('Admin')}` };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: AdminLoading,
  component: AdminDecisionInstancePage,
});

function AdminDecisionInstancePage() {
  return <DecisionInstanceDetail instanceId={Route.useParams().instanceId} />;
}
