import { getPublicUrl } from '@/utils';
import { trpcNext } from '@op/api/vanilla';
import { cn, getGradientForString } from '@op/ui/utils';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';

import { Link } from '@/lib/i18n';

import { ImageHeader } from '@/components/ImageHeader';
import {
  ProfileTabs,
  ProfileTabsMobile,
} from '@/components/Profile/ProfileContent';
import { ProfileDetails } from '@/components/Profile/ProfileDetails';

const OrganizationProfileWithData = async ({ slug }: { slug: string }) => {
  try {
    const client = await trpcNext();
    const organization = await client.organization.getBySlug.query({
      slug,
    });

    const { headerImage, avatarImage } = organization.profile;
    const headerUrl = getPublicUrl(headerImage?.name);
    const avatarUrl = getPublicUrl(avatarImage?.name);

    const gradientBg = getGradientForString(
      organization.profile.name || 'Common',
    );
    const gradientBgHeader = getGradientForString(
      organization.profile.name + 'C' || 'Common',
    );

    return (
      <>
        <ImageHeader
          headerImage={
            headerUrl ? (
              <Image src={headerUrl} alt="" fill className="object-cover" />
            ) : (
              <div className={cn('h-full w-full', gradientBgHeader)} />
            )
          }
          avatarImage={
            avatarUrl ? (
              <Image src={avatarUrl} alt="" fill className="object-cover" />
            ) : (
              <div className={cn('h-full w-full', gradientBg)} />
            )
          }
        />

        <ProfileDetails profile={organization} />
        <ProfileTabs profile={organization} />
        <ProfileTabsMobile profile={organization} />
      </>
    );
  } catch (e) {
    console.error(e);
    notFound();
  }
};

export const OrganizationProfile = ({ slug }: { slug: string }) => {
  return (
    <>
      {/* nav arrow */}
      <header className="absolute left-0 top-0 z-50 px-4 py-3 sm:hidden">
        <Link href="/">
          <LuArrowLeft className="size-6 text-neutral-offWhite" />
        </Link>
      </header>
      <div className="-mt-[3.05rem] flex w-full flex-col gap-3 border-offWhite border-b-transparent sm:mt-0 sm:min-h-[calc(100vh-3.5rem)] sm:gap-4 sm:border">
        <OrganizationProfileWithData slug={slug} />
      </div>
    </>
  );
};
