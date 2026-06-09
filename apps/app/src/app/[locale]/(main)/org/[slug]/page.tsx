import { createClient } from '@op/api/serverClient';
import type { Metadata } from 'next';

import { Profile } from '@/components/screens/Profile';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const client = await createClient();
    const profile = await client.profile.getBySlug({ slug });
    return profile.name ? { title: profile.name } : {};
  } catch {
    return {};
  }
}

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <Profile slug={slug} />;
};

export default OrganizationPage;
