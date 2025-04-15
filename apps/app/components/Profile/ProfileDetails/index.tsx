import { Button } from '@op/ui/Button';
import { ProfileSummary } from '../ProfileSummary';
import { LuArrowUpRight, LuPlus } from 'react-icons/lu';

export const ProfileDetails = () => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <ProfileSummary />
      <div className="text-base">
        Planting the seeds for the next economy through labor organizing
        centered on food justice.
      </div>
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
