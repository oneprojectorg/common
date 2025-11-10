import { getPublicUrl } from '@/utils';
import { ProfileSearchResult } from '@op/api/encoders';
import { Avatar } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
import Image from 'next/image';
import { LuX } from 'react-icons/lu';

interface SelectedChipProps {
  profile: ProfileSearchResult;
  onRemove: (profile: ProfileSearchResult) => void;
  className?: string;
}

export const SelectedChip = ({
  profile,
  onRemove,
  className,
}: SelectedChipProps) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-white px-3 py-2',
        className,
      )}
    >
      <Avatar placeholder={profile.name} className="size-6">
        {profile.avatarImage?.name ? (
          <Image
            src={getPublicUrl(profile.avatarImage.name) ?? ''}
            alt={`${profile.name} avatar`}
            fill
            className="object-cover"
          />
        ) : null}
      </Avatar>

      <div className="flex flex-col text-sm">
        <span className="font-normal text-neutral-charcoal">
          {profile.name}
        </span>
        {profile.city && (
          <span className="text-xs text-neutral-gray4">{profile.city}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onRemove(profile)}
        className="ml-auto flex size-6 items-center justify-center rounded-full bg-white/80 hover:bg-neutral-offWhite"
        aria-label={`Remove ${profile.name}`}
      >
        <LuX className="size-4 text-neutral-charcoal" />
      </button>
    </div>
  );
};
