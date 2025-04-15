import { LuArrowUpRight, LuPlus } from 'react-icons/lu';

import { Button } from '@op/ui/Button';

import { ProfileSummary } from '../ProfileSummary';

import type { Organization } from '@op/trpc/encoders';

export const ProfileDetails = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <ProfileSummary profile={profile} />
      <div className="text-base">{profile.description}</div>
      <div className="flex gap-4">
        <Button>
          <LuArrowUpRight />
          Contribute
        </Button>
        <Button color="secondary" variant="icon">
          <LuPlus />
          Add relationship
        </Button>
      </div>

      <div className="text-xs text-darkGray">
        Raising integrated capital for our operating budget.
      </div>
    </div>
  );
};
