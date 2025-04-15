import { Button } from '@op/ui/Button';
import { ProfileSummary } from '../ProfileSummary';

export const ProfileDetails = () => {
  return (
    <div className="flex w-full flex-col gap-3">
      <ProfileSummary />
      <div>
        A community-led organization building economic democracy and collective
        ownership in Grove Hall, Boston.
      </div>
      <div className="flex gap-4">
        <Button>Contribute</Button>
        <Button color="secondary" variant="icon">
          Add relationship
        </Button>
      </div>
    </div>
  );
};
