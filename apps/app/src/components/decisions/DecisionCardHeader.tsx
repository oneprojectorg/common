import { getPublicUrl } from '@/utils';
import { Badge } from '@op/sense/Badge';
import { Header3 } from '@op/sense/Header';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { cn } from '@op/sense/lib/utils';

import type { TranslationKey } from '@/lib/i18n';

import { TranslatedText } from '../TranslatedText';

/**
 * Name, then who stewards it, then the phase chip alongside whatever metadata
 * the caller passes as `children` (Figma 17827:3655).
 *
 * The chip shares the last line rather than sitting beside the name, so a long
 * process name gets the full width before it wraps.
 */
export const DecisionCardHeader = ({
  name,
  currentState,
  chipVariant = 'accent',
  stewardName,
  stewardAvatarPath,
  children,
  className,
}: {
  name: string;
  currentState?: string | null;
  /** `secondary` for a draft, whose phase isn't a real phase. */
  chipVariant?: 'accent' | 'secondary';
  stewardName?: string | null;
  stewardAvatarPath?: string | null;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-col gap-3', className)}>
    <Header3>{name}</Header3>
    {stewardName ? (
      <div className="flex items-center gap-2">
        <ProfileAvatar
          name={stewardName}
          src={getPublicUrl(stewardAvatarPath)}
          alt={stewardName}
          size="sm"
        />
        <span className="text-sm text-muted-foreground">{stewardName}</span>
      </div>
    ) : null}
    {currentState || children ? (
      <div className="flex flex-wrap items-center gap-3">
        {currentState ? (
          <Badge variant={chipVariant}>
            <TranslatedText text={currentState as TranslationKey} />
          </Badge>
        ) : null}
        {children}
      </div>
    ) : null}
  </div>
);
