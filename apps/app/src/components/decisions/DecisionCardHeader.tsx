import { getPublicUrl } from '@/utils';
import { Avatar } from '@op/ui/Avatar';
import { Chip } from '@op/ui/Chip';
import { Header3 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

export const DecisionCardHeader = ({
  name,
  currentState,
  stewardName,
  stewardAvatarPath,
  children,
  className,
}: {
  name: string;
  currentState?: string | null;
  stewardName?: string | null;
  stewardAvatarPath?: string | null;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <div className="flex items-start justify-between gap-2 sm:items-center sm:justify-start">
      <Header3 className="font-serif !text-title-base text-neutral-black">
        {name}
      </Header3>
      {currentState ? (
        <Chip className="bg-primary-tealWhite text-primary-tealBlack">
          {currentState}
        </Chip>
      ) : null}
    </div>
    {stewardName ? (
      <div className="flex items-center gap-1">
        <Avatar placeholder={stewardName} className="size-4">
          {stewardAvatarPath ? (
            <Image
              src={getPublicUrl(stewardAvatarPath) ?? ''}
              alt={stewardName}
              fill
              className="object-cover"
            />
          ) : null}
        </Avatar>
        <span className="text-sm text-neutral-black">{stewardName}</span>
      </div>
    ) : null}
    {children}
  </div>
);
