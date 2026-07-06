import { useCanLinkToProfile } from '@/hooks/useCanLinkToProfile';
import { getPublicUrl } from '@/utils';
import { Avatar } from '@op/ui/Avatar';
import { GrowingFacePile } from '@op/ui/GrowingFacePile';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

import { Link, useTranslations } from '@/lib/i18n/routing';

type Submitter = {
  slug: string;
  name?: string | null;
  avatarImage?: {
    name: string;
  } | null;
};

export const MemberParticipationFacePile = ({
  submitters,
  total,
  hasImage = false,
}: {
  submitters: Submitter[];
  total: number;
  /** Over a banner image the charcoal label loses contrast — use white. */
  hasImage?: boolean;
}) => {
  const t = useTranslations();
  const canLinkToProfile = useCanLinkToProfile();

  if (total === 0) {
    return null;
  }

  const hasSubmitters = submitters.length > 0;

  return (
    <div className="flex items-center justify-center gap-2">
      <GrowingFacePile
        maxItems={20}
        totalCount={hasSubmitters ? total : undefined}
        items={submitters.map((submitter) => {
          const avatarImage = submitter.avatarImage?.name ? (
            <Image
              src={getPublicUrl(submitter.avatarImage.name) ?? ''}
              alt={submitter.name || submitter.slug || ''}
              width={32}
              height={32}
              className="aspect-square object-cover"
            />
          ) : null;

          // Public/non-member viewers can't reach the profile page, so render
          // the avatar without a link.
          return canLinkToProfile ? (
            <Link
              key={submitter.slug}
              href={`/profile/${submitter.slug}`}
              className="hover:no-underline"
            >
              <Avatar placeholder={submitter.name || submitter.slug || 'U'}>
                {avatarImage}
              </Avatar>
              <div className="absolute start-0 top-0 h-full w-full cursor-pointer rounded-full bg-white opacity-0 transition-opacity duration-100 ease-in-out hover:opacity-15 active:bg-black" />
            </Link>
          ) : (
            <Avatar
              key={submitter.slug}
              placeholder={submitter.name || submitter.slug || 'U'}
            >
              {avatarImage}
            </Avatar>
          );
        })}
      >
        <span
          className={cn(
            'w-fit text-sm',
            hasImage ? 'text-white' : 'text-neutral-charcoal',
          )}
        >
          {t(
            '{count, plural, =1 {1 member has submitted proposals} other {# members have submitted proposals}}',
            { count: total },
          )}
        </span>
      </GrowingFacePile>
    </div>
  );
};
