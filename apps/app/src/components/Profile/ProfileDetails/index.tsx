import { LuArrowUpRight, LuInfo, LuPlus } from 'react-icons/lu';

import { Button, ButtonLink } from '@op/ui/Button';
import { SkeletonLine } from '@op/ui/Skeleton';

import { ProfileSummary } from '../ProfileSummary';

import type { Organization } from '@op/trpc/encoders';

const ProfileInteractions = ({ profile }: { profile: Organization }) => {
  const { isReceivingFunds, isOfferingFunds, links } = profile;

  // split funding links up by type
  const receivingFundingLinks = links.filter(
    (fundingLink) => fundingLink.type === 'receiving',
  );
  const offeringFundingLinks = links.filter(
    (fundingLink) => fundingLink.type === 'offering',
  );

  return (
    <div className="flex gap-4">
      {isReceivingFunds
        ? receivingFundingLinks.map((link) => (
            <ButtonLink href={link.href} className="min-w-44">
              <LuArrowUpRight />
              Contribute
            </ButtonLink>
          ))
        : null}

      {isOfferingFunds
        ? offeringFundingLinks.map((link) => (
            <ButtonLink href={link.href} className="min-w-44">
              <LuInfo />
              Learn more
            </ButtonLink>
          ))
        : null}

      <Button color="secondary" variant="icon" className="min-w-44">
        <LuPlus />
        Add relationship
      </Button>
    </div>
  );
};

export const ProfileDetails = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <ProfileSummary profile={profile} />
      <div className="text-base">{profile.description}</div>
      <ProfileInteractions profile={profile} />

      <div className="text-xs text-darkGray">{profile.description}</div>
    </div>
  );
};

export const ProfileDetailsSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <SkeletonLine className="text-base" />
      <SkeletonLine className="text-base" />
      <div className="flex gap-4" />

      <SkeletonLine />
    </div>
  );
};
