import { createFileRoute, getRouteApi } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { OnboardingFlow } from '@/components/Onboarding';

const startLayout = getRouteApi('/$locale/start');

export const Route = createFileRoute('/$locale/start/')({
  loader: async ({ params }) => {
    const t = await getTranslations({
      namespace: 'shell',
      locale: params.locale,
    });

    return { title: t('getStartedTitle') };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  // Membership is resolved server-side so OnboardingFlow branches synchronously.
  const user = startLayout.useLoaderData();

  return (
    <div className="flex flex-1 flex-col items-center">
      <OnboardingFlow isNetworkMember={user?.isNetworkMember ?? false} />
    </div>
  );
}
