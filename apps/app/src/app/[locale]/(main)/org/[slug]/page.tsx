import { Profile } from '@/components/screens/Profile';

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <Profile slug={slug} />;
};

export default OrganizationPage;
