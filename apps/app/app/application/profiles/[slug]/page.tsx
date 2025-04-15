import { ImageHeader } from '@/components/ImageHeader';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';
import { ProfileTabs } from '@/components/Profile/ProfileTabs';

const OrganizationPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;

  return (
    <div className="flex w-full flex-col gap-3 outline outline-1 -outline-offset-1 outline-offWhite">
      <ImageHeader />
      <ProfileDetails />
      <ProfileTabs />
    </div>
  );
};

export default OrganizationPage;
