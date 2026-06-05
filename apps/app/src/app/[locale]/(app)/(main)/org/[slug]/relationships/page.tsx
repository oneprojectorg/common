import { ProfileRelationships } from '@/components/screens/ProfileRelationships';

const OrganizationRelationshipsPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return <ProfileRelationships slug={slug} />;
};

export default OrganizationRelationshipsPage;
