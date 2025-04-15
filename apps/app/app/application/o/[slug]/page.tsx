import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';
import { ProfileFeed } from '@/components/Profile/ProfileFeed';

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return (
    <div className="flex w-full flex-col gap-3">
      <ImageHeader />
      <ProfileDetails />
      <ProfileFeed />
    </div>
  );
};

export default OrganizationPage;
