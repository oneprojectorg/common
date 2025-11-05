'use client';

import { Button } from '@op/ui/Button';
import { LuArrowUpRight, LuPlus } from 'react-icons/lu';

/** Platform admin header with title and action buttons */
export const PlatformAdminHeader = () => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-title-md text-neutral-black">
          Platform admin
        </h1>
      </div>
      <div className="flex gap-3">
        <Button color="secondary" size="small" className="gap-2">
          <LuArrowUpRight className="size-4" />
          View all analytics
        </Button>
        <Button variant="primary" size="small" className="gap-2">
          <LuPlus className="size-4" />
          Add user
        </Button>
      </div>
    </div>
  );
};
