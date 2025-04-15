import { OrganizationProfile } from '@/components/screens/OrganizationProfile';

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  return <OrganizationProfile id={id} />;
};

export default OrganizationPage;
