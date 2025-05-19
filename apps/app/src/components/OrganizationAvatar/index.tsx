import { getPublicUrl } from '@/utils';
import { RouterOutput } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { cn } from '@op/ui/utils';
import Image from 'next/image';

import { Link } from '@/lib/i18n';

type relationshipOrganization =
  RouterOutput['organization']['listRelationships']['organizations'][number];

export const OrganizationAvatar = ({
  organization,
  className,
}: {
  organization: relationshipOrganization;
  className?: string;
}) => {
  return (
    <Link href={`/org/${organization.slug}`}>
      <Avatar className={cn('size-12', className)}>
        {organization.name ? (
          <Image
            src={
              getPublicUrl(
                // @ts-expect-error
                organization.avatarImage?.name,
              ) ?? ''
            }
            width={80}
            height={80}
            alt={organization.name}
          />
        ) : (
          <div className="flex size-8 items-center justify-center text-neutral-gray3">
            {organization.name?.slice(0, 1) ?? ''}
          </div>
        )}
      </Avatar>
    </Link>
  );
};
