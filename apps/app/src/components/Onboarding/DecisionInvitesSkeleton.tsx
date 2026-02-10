import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';

import { FormContainer } from '../form/FormContainer';

export const DecisionInvitesSkeleton = ({
  className,
}: {
  className?: string;
}) => (
  <div className={cn('flex w-full max-w-lg flex-1 flex-col justify-center', className)}>
    <FormContainer>
      <div className="flex flex-col gap-2 text-center">
        <Skeleton className="mx-auto h-8 w-3/4" />
        <Skeleton className="mx-auto h-5 w-full" />
      </div>
      <div className="flex flex-col gap-6">
        <Surface className="flex items-center gap-6 p-6">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </Surface>
      </div>
      <Skeleton className="h-10 w-full" />
    </FormContainer>
  </div>
);
