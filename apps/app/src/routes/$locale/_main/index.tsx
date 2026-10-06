import {
  listNewOrganizations,
  prefetchLandingFeed,
} from '@/server/landing.functions';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import {
  LandingScreen,
  LandingScreenSkeleton,
} from '@/components/screens/LandingScreen';

const mainLayout = getRouteApi('/$locale/_main');

export const Route = createFileRoute('/$locale/_main/')({
  loader: async ({ params }) => {
    const t = await getTranslations({ locale: params.locale });

    return {
      title: t('Home'),
      // Not awaited: the shell renders first and these stream in.
      feedState: prefetchLandingFeed(),
      newOrganizations: listNewOrganizations({ data: { limit: 5 } }),
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [pageTitle(loaderData.title)] : [],
  }),
  pendingComponent: LandingScreenSkeleton,
  component: MainPage,
});

function MainPage() {
  const user = mainLayout.useLoaderData();
  const { feedState, newOrganizations } = Route.useLoaderData();

  return (
    <LandingScreen
      user={user}
      feedState={feedState}
      newOrganizations={newOrganizations}
    />
  );
}
