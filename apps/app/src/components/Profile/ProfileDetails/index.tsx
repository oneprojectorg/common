'use client';

import { formatToUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
import { ButtonLink } from '@op/ui/Button';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { LuArrowUpRight, LuInfo } from 'react-icons/lu';

import { ProfileSummary } from '../ProfileSummary';
import { AddRelationshipModal } from './AddRelationshipModal';
import { UpdateOrganizationModal } from './UpdateOrganizationModal';

const ProfileInteractions = ({ profile }: { profile: Organization }) => {
  const { user } = useUser();
  const { isReceivingFunds, isOfferingFunds, links } = profile;

  // split funding links up by type
  const receivingFundingLinks = links.filter(
    (fundingLink) => fundingLink.type === 'receiving',
  );
  const offeringFundingLinks = links.filter(
    (fundingLink) => fundingLink.type === 'offering',
  );

  return (
    <div className="flex flex-wrap gap-3 sm:h-fit sm:max-w-fit sm:justify-end sm:gap-4 sm:py-2">
      {user?.currentOrganization?.id !== profile.id ? (
        <AddRelationshipModal profile={profile} />
      ) : (
        <UpdateOrganizationModal profile={profile} />
      )}
      {isReceivingFunds
        ? receivingFundingLinks.map((link) => (
            <TooltipTrigger key={link.id}>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <ButtonLink
                  color="secondary"
                  href={formatToUrl(link.href)}
                  target="_blank"
                  className="min-w-full sm:min-w-fit"
                >
                  <LuArrowUpRight className="size-4 stroke-1" />
                  Contribute
                </ButtonLink>
                <Tooltip>{link.description ?? 'Click to learn more'}</Tooltip>

                {link.description ? (
                  <div className="flex w-full items-center justify-center text-sm text-neutral-charcoal sm:hidden">
                    {link.description}
                  </div>
                ) : null}
              </div>
            </TooltipTrigger>
          ))
        : null}
      {isOfferingFunds
        ? offeringFundingLinks.map((link) => (
            <TooltipTrigger key={link.id}>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <ButtonLink
                  color="secondary"
                  href={formatToUrl(link.href)}
                  target="_blank"
                  className="min-w-full sm:min-w-fit"
                >
                  <LuInfo className="size-4 stroke-1" />
                  Learn more
                </ButtonLink>
                <Tooltip>{link.description ?? 'Click to learn more'}</Tooltip>
                {link.description ? (
                  <div className="flex w-full items-center justify-center text-sm text-neutral-charcoal sm:hidden">
                    {link.description}
                  </div>
                ) : null}
              </div>
            </TooltipTrigger>
          ))
        : null}
    </div>
  );
};

export const ProfileDetails = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
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
