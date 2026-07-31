import { getPublicUrl } from '@/utils';
import { Badge } from '@op/sense/Badge';
import { Header3 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { cn } from '@op/sense/lib/utils';

import type { TranslationKey } from '@/lib/i18n';

import { TranslatedText } from '../TranslatedText';

export const DecisionCardHeader = ({
  name,
  currentState,
  stewardName,
  stewardAvatarPath,
  chipClassName,
  children,
  className,
}: {
  name: string;
  currentState?: string | null;
  stewardName?: string | null;
  stewardAvatarPath?: string | null;
  chipClassName?: string;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-col gap-2', className)}>
    <div className="flex items-start justify-between gap-2 sm:items-center sm:justify-start">
      <Header3 className="font-serif text-neutral-black">{name}</Header3>
      {currentState ? (
        <Badge
          variant="secondary"
          className={
            chipClassName ?? 'bg-primary-tealWhite text-primary-tealBlack'
          }
        >
          <TranslatedText text={currentState as TranslationKey} />
        </Badge>
      ) : null}
    </div>
    {stewardName ? (
      <div className="flex items-center gap-1">
        <ProfileAvatar
          name={stewardName}
          src={getPublicUrl(stewardAvatarPath)}
          alt={stewardName}
          size="sm"
        />
        <span className="text-sm text-neutral-black">{stewardName}</span>
      </div>
    ) : null}
    {children}
  </div>
);
