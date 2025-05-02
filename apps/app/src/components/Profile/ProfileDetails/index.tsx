import type { Organization } from '@op/trpc/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { LuArrowUpRight, LuInfo, LuPlus } from 'react-icons/lu';

import { ProfileSummary } from '../ProfileSummary';

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
    <div className="flex flex-wrap gap-3 sm:gap-4">
      {isReceivingFunds
        ? receivingFundingLinks.map((link) => (
            <TooltipTrigger key={link.id}>
              <ButtonLink
                color="secondary"
                href={link.href}
                className="min-w-full sm:min-w-44"
              >
                <LuArrowUpRight className="size-4" />
                Contribute
              </ButtonLink>
              <Tooltip>We accept applications on a rolling basis</Tooltip>
            </TooltipTrigger>
          ))
        : null}

      {isOfferingFunds
        ? offeringFundingLinks.map((link) => (
            <TooltipTrigger key={link.id}>
              <ButtonLink
                color="secondary"
                href={link.href}
                className="min-w-full sm:min-w-44"
              >
                <LuInfo />
                Learn more
              </ButtonLink>
              <Tooltip>We’re an invite-only granting organization</Tooltip>
            </TooltipTrigger>
          ))
        : null}

      <Button className="min-w-full sm:min-w-44">
        <LuPlus className="size-4" />
        Add relationship
      </Button>
    </div>
  );
};

export const ProfileDetails = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <ProfileSummary profile={profile} />
      <ProfileInteractions profile={profile} />
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
