import { Profile } from '@/components/screens/Profile';

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
