'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import type { Organization } from '@op/api/encoders';
import { EntityType } from '@op/api/encoders';
import { formatToUrl } from '@op/common/validation';
import { Button } from '@op/sense/Button';
import { SkeletonText } from '@op/sense/Skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import { LuHandCoins, LuInfo } from 'react-icons/lu';

import { ProfileSummary } from '../ProfileSummary';
import { AddRelationshipModal } from './AddRelationshipModal';
import { FollowButton } from './FollowButton';
import { InviteToOrganizationButton } from './InviteToOrganizationButton';
import { RequestMembershipButton } from './RequestMembershipButton';
import { UpdateOrganizationModal } from './UpdateOrganizationModal';
import { UpdateUserProfileModal } from './UpdateProfile';

const ProfileInteractions = ({ profile }: { profile: Organization }) => {
  const { user } = useRequiredUser();
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
    user.currentProfile?.id ===
    (isOrganizationProfile ? profile.profile.id : profile.id);

  // Check if current user is Individual viewing an Organization
  const isCurrentUserIndividual =
    user.currentProfile?.type === EntityType.INDIVIDUAL;
  const shouldShowFollowButton =
    isCurrentUserIndividual && isOrganizationProfile && !isViewingOwnProfile;

  // Check if current user is Organization viewing an Individual
  const isCurrentUserOrganization =
    user.currentProfile?.type === EntityType.ORG;
  const shouldShowInviteButton =
    isCurrentUserOrganization &&
    profile.profile.type === EntityType.INDIVIDUAL &&
    !isViewingOwnProfile;

  // Check if user is already a member of this organization
  const isAlreadyMember = user.organizationUsers?.some(
    (orgUser) => orgUser.organization?.profile?.id === profile.profile.id,
  );
  const shouldShowRequestMembershipButton =
    isCurrentUserIndividual &&
    isOrganizationProfile &&
    !isAlreadyMember &&
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
    <TooltipProvider delay={500}>
      <div className="flex flex-wrap gap-3 sm:h-fit sm:max-w-fit sm:justify-end sm:gap-4 sm:py-2">
        {isViewingOwnProfile ? (
          isOrganizationProfile ? (
            <UpdateOrganizationModal organization={profile} />
          ) : (
            <UpdateUserProfileModal profile={profile.profile} />
          )
        ) : (
          <>
            {shouldShowFollowButton && <FollowButton profile={profile} />}
            {shouldShowRequestMembershipButton && (
              <RequestMembershipButton profile={profile} />
            )}
            {!shouldShowFollowButton && !shouldShowRequestMembershipButton && (
              <AddRelationshipModal profile={profile} />
            )}
          </>
        )}
        {isReceivingFunds
          ? receivingFundingLinks.map((link) => {
              const description = link.description?.trim();

              return (
                <Tooltip key={link.id}>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          render={
                            <a href={formatToUrl(link.href)} target="_blank" />
                          }
                          className="min-w-full sm:min-w-fit"
                        >
                          <LuHandCoins className="size-4" />
                          Fund
                        </Button>
                      }
                    />
                    {description ? (
                      <TooltipContent>{description}</TooltipContent>
                    ) : null}

                    {description ? (
                      <div className="flex w-full items-center justify-center text-sm text-neutral-charcoal sm:hidden">
                        {description}
                      </div>
                    ) : null}
                  </div>
                </Tooltip>
              );
            })
          : null}
        {isOfferingFunds
          ? offeringFundingLinks.map((link) => {
              const description = link.description?.trim();
              return (
                <Tooltip key={link.id}>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          render={
                            <a href={formatToUrl(link.href)} target="_blank" />
                          }
                          className="min-w-full sm:min-w-fit"
                        >
                          <LuInfo className="size-4" />
                          Learn more
                        </Button>
                      }
                    />
                    {description ? (
                      <TooltipContent>{description}</TooltipContent>
                    ) : null}
                    {description ? (
                      <div className="flex w-full items-center justify-center text-sm text-neutral-charcoal sm:hidden">
                        {description}
                      </div>
                    ) : null}
                  </div>
                </Tooltip>
              );
            })
          : null}
      </div>
    </TooltipProvider>
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
      <SkeletonText lines={10} className="gap-3" />
      <SkeletonText lines={10} className="gap-3" />
      <div className="flex gap-4" />

      <SkeletonText lines={10} className="gap-3" />
    </div>
  );
};
