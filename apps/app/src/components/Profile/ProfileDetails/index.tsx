import { LuArrowUpRight, LuPlus } from 'react-icons/lu';

import { Button } from '@op/ui/Button';
import { SkeletonLine } from '@op/ui/Skeleton';

import { ProfileSummary } from '../ProfileSummary';

import type { Organization } from '@op/trpc/encoders';

const ProfileInteractions = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex gap-4">
      {profile.isReceivingFunds ? (
        <Button>
          <LuArrowUpRight />
          Contribute
        </Button>
      ) : null}

      {profile.isReceivingFunds ? (
        <Button color="secondary" variant="icon">
          <LuPlus />
          Add relationship
        </Button>
      ) : null}
    </div>
  );
};

export const ProfileDetails = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <ProfileSummary profile={profile} />
      <div className="text-base">{profile.description}</div>
      <ProfileInteractions profile={profile} />

      <div className="text-xs text-darkGray">{profile.description}</div>
    </div>
  );
};

export const ProfileDetailsSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <SkeletonLine className="text-base" />
      <SkeletonLine className="text-base" />
      <div className="flex gap-4"></div>

      <SkeletonLine />
    </div>
  );
};
