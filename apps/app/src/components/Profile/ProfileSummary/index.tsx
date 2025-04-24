import { Header1 } from '@/components/Header';

import type { Organization } from '@op/trpc/encoders';

export const ProfileSummary = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex flex-col gap-4 py-2">
      <Header1>{profile.name}</Header1>
      <div className="text-sm text-darkGray">
        {profile.city && profile.state
          ? `${profile.city}, ${profile.state}`
          : null}
      </div>
      <div className="text-sm text-darkGray">
        <span className="font-semibold">0</span> relationships
      </div>
    </div>
  );
};
