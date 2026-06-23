import type { Metadata } from 'next';

import { Profile } from '@/components/screens/Profile';
import { fetchProfileBySlug } from '@/components/screens/Profile/cachedFetches';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const profile = await fetchProfileBySlug(slug);
    return profile.name ? { title: profile.name } : {};
  } catch {
    return {};
  }
}

const ProfilePage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) => {
  const { slug } = await params;
  const { tab } = await searchParams;

  return <Profile slug={slug} initialTab={tab} />;
};

export default ProfilePage;
