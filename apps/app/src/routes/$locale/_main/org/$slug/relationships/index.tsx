import { getProfileName } from '@/server/profiles.functions';
import { createFileRoute } from '@tanstack/react-router';

import { pageTitle } from '@/lib/head';
import { getTranslations } from '@/lib/i18n';

import { ProfileRelationships } from '@/components/screens/ProfileRelationships';

export const Route = createFileRoute('/$locale/_main/org/$slug/relationships/')(
  {
    loader: async ({ params }) => {
      const [name, t] = await Promise.all([
        getProfileName({ data: { slug: params.slug } }),
        getTranslations({ locale: params.locale }),
      ]);
      const label = t('profile.relationshipsTab');

      return { title: name ? `${label} | ${name}` : label };
    },
    head: ({ loaderData }) => ({
      meta: loaderData ? [pageTitle(loaderData.title)] : [],
    }),
    component: OrganizationRelationshipsPage,
  },
);

function OrganizationRelationshipsPage() {
  const { slug } = Route.useParams();

  return <ProfileRelationships slug={slug} />;
}
