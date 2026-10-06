import { getProfilePageData } from '@/server/profiles.functions';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { useSearchParams } from '@/lib/navigation';

import { Profile } from '@/components/screens/Profile';

export const Route = createFileRoute('/$locale/_main/profile/$slug/')({
  loader: ({ params }) => getProfilePageData({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.profile.name ? [pageTitle(loaderData.profile.name)] : [],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, organization } = Route.useLoaderData();
  const initialTab = useSearchParams().get('tab') ?? undefined;

  return (
    <Profile
      profile={profile}
      organization={organization}
      initialTab={initialTab}
    />
  );
}
