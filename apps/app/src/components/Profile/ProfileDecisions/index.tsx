import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { LuLeaf, LuPlus } from 'react-icons/lu';

import { CreateDecisionProcessModal } from '../CreateDecisionProcessModal';

export const ProfileDecisions = () => {
  return (
    <>
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-neutral-gray1">
          <LuLeaf className="size-6 text-neutral-gray4" />
        </div>

        <div className="flex max-w-md flex-col gap-2">
          <h2 className="font-serif text-title-base text-neutral-black">
            Set up your decision-making process
          </h2>
          <p className="text-base text-neutral-charcoal">
            Create your first participatory budgeting or grantmaking process to
            start collecting proposals from your community.
          </p>
        </div>

        <DialogTrigger>
          <Button color="primary" size="medium" variant="icon">
            <LuPlus className="size-4" />
            Create Process
          </Button>
          <CreateDecisionProcessModal />
        </DialogTrigger>
      </div>
    </>
  );
};

export const ProfileDecisionsSuspense = () => {
  return <ProfileDecisions />;
};
