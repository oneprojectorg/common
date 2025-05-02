import { OrganizationProfile } from '@/components/screens/OrganizationProfile';

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <OrganizationProfile slug={slug} />;
};

export default OrganizationPage;
