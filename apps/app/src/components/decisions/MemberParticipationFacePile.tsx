import { getPublicUrl } from '@/utils';
import { pluralize } from '@/utils/pluralize';
import { Avatar } from '@op/ui/Avatar';
import { GrowingFacePile } from '@op/ui/GrowingFacePile';
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
}: {
  submitters: Submitter[];
}) => {
  const t = useTranslations();

  if (submitters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <GrowingFacePile
        maxItems={20}
        items={submitters.map((submitter) => (
          <Link
            key={submitter.slug}
            href={`/profile/${submitter.slug}`}
            className="hover:no-underline"
          >
            <Avatar placeholder={submitter.name || submitter.slug || 'U'}>
              {submitter.avatarImage?.name ? (
                <Image
                  src={getPublicUrl(submitter.avatarImage.name) ?? ''}
                  alt={submitter.name || submitter.slug || ''}
                  width={32}
                  height={32}
                  className="aspect-square object-cover"
                />
              ) : null}
            </Avatar>
            <div className="absolute top-0 left-0 h-full w-full cursor-pointer rounded-full bg-white opacity-0 transition-opacity duration-100 ease-in-out hover:opacity-15 active:bg-black" />
          </Link>
        ))}
      >
        <span className="w-fit text-sm text-neutral-charcoal">
          {submitters.length} {pluralize(t('member'), submitters.length)}{' '}
          {submitters.length > 1 ? t('have') : t('has')}{' '}
          {t('submitted proposals')}
        </span>
      </GrowingFacePile>
    </div>
  );
};
