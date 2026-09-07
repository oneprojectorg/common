import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

import { ProfileRelationships } from '@/components/screens/ProfileRelationships';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;

  try {
    const [client, t] = await Promise.all([
      createClient(),
      getTranslations({ locale }),
    ]);
    const profile = await client.profile.getBySlug({ slug });
    const label = t('Relationships');
    return { title: profile.name ? `${label} | ${profile.name}` : label };
  } catch {
    return {};
  }
}

const OrganizationRelationshipsPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <ProfileRelationships slug={slug} />;
};

export default OrganizationRelationshipsPage;
