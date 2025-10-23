'use client';

import { formatToUrl } from '@/utils';
import { useUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
import { EntityType } from '@op/api/encoders';
import { ButtonLink } from '@op/ui/Button';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { LuHandCoins, LuInfo } from 'react-icons/lu';

import { ProfileSummary } from '../ProfileSummary';
import { AddRelationshipModal } from './AddRelationshipModal';
import { FollowButton } from './FollowButton';
import { InviteToOrganizationButton } from './InviteToOrganizationButton';
import { UpdateOrganizationModal } from './UpdateOrganizationModal';
import { UpdateUserProfileModal } from './UpdateUserProfileModal';

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

  const isOrganizationProfile = profile.profile?.type === EntityType.ORG;
  const isViewingOwnProfile =
    user?.currentProfile?.id ===
    (isOrganizationProfile ? profile.profile.id : profile.id);

  // Check if current user is Individual viewing an Organization
  const isCurrentUserIndividual =
    user?.currentProfile?.type === EntityType.INDIVIDUAL;
  const shouldShowFollowButton =
    isCurrentUserIndividual && isOrganizationProfile && !isViewingOwnProfile;

  // Check if current user is Organization viewing an Individual
  const isCurrentUserOrganization =
    user?.currentProfile?.type === EntityType.ORG;
  const shouldShowInviteButton =
    isCurrentUserOrganization &&
    profile.profile.type === EntityType.INDIVIDUAL &&
    !isViewingOwnProfile;

  if (!isViewingOwnProfile && profile.profile.type === EntityType.INDIVIDUAL) {
    if (shouldShowInviteButton) {
      return (
        <div className="flex flex-wrap gap-3 sm:h-fit sm:max-w-fit sm:justify-end sm:gap-4 sm:py-2">
          <InviteToOrganizationButton profile={profile} />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3 sm:h-fit sm:max-w-fit sm:justify-end sm:gap-4 sm:py-2">
      {!isViewingOwnProfile ? (
        shouldShowFollowButton ? (
          <FollowButton profile={profile} />
        ) : (
          <AddRelationshipModal profile={profile} />
        )
      ) : isOrganizationProfile ? (
        <UpdateOrganizationModal organization={profile} />
      ) : (
        <UpdateUserProfileModal profile={profile.profile} />
      )}
      {isReceivingFunds
        ? receivingFundingLinks.map((link) => {
            const description = link.description?.trim();

            return (
              <TooltipTrigger key={link.id}>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <ButtonLink
                    color="secondary"
                    href={formatToUrl(link.href)}
                    target="_blank"
                    className="min-w-full sm:min-w-fit"
                  >
                    <LuHandCoins className="size-4" />
                    Fund
                  </ButtonLink>
                  {description ? <Tooltip>{description}</Tooltip> : null}

                  {description ? (
                    <div className="flex w-full items-center justify-center text-sm text-neutral-charcoal sm:hidden">
                      {description}
                    </div>
                  ) : null}
                </div>
              </TooltipTrigger>
            );
          })
        : null}
      {isOfferingFunds
        ? offeringFundingLinks.map((link) => {
            const description = link.description?.trim();
            return (
              <TooltipTrigger key={link.id}>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <ButtonLink
                    color="secondary"
                    href={formatToUrl(link.href)}
                    target="_blank"
                    className="min-w-full sm:min-w-fit"
                  >
                    <LuInfo className="size-4" />
                    Learn more
                  </ButtonLink>
                  {description ? <Tooltip>{description}</Tooltip> : null}
                  {description ? (
                    <div className="flex w-full items-center justify-center text-sm text-neutral-charcoal sm:hidden">
                      {description}
                    </div>
                  ) : null}
                </div>
              </TooltipTrigger>
            );
          })
        : null}
    </div>
  );
};

export const ProfileDetails = ({
  organization,
}: {
  organization: Organization;
}) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4 sm:flex-row sm:justify-between sm:px-6">
      <ProfileSummary profile={organization} />
      <ProfileInteractions profile={organization} />
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
