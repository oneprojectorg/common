import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal } from '@op/ui/Modal';
import { DialogTrigger } from '@op/ui/RAC';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { Suspense } from 'react';
import {
  LuArrowUpRight,
  LuCheck,
  LuClock,
  LuInfo,
  LuPlus,
} from 'react-icons/lu';

import ErrorBoundary from '@/components/ErrorBoundary';

import { ProfileSummary } from '../ProfileSummary';
import { AddRelationshipForm } from './AddRelationshipForm';
import { RemoveRelationshipModal } from './RemoveRelationshipModal';

const AddRelationshipModal = ({ profile }: { profile: Organization }) => {
  const utils = trpc.useUtils();
  const [{ relationships }] =
    trpc.organization.listDirectedRelationships.useSuspenseQuery({
      to: profile.id,
    });

  return (
    <>
      {relationships.length > 0 ? (
        relationships.map((relationship) => {
          return (
            <TooltipTrigger isDisabled={!relationship.pending}>
              {(() => {
                switch (relationship.relationshipType) {
                  case 'partnership':
                    return (
                      <DialogTrigger>
                        <Button color="secondary">
                          {relationship.pending ? <LuClock /> : <LuCheck />}
                          Partner
                        </Button>
                        {relationship.pending && (
                          <Tooltip>
                            Pending confirmation from {profile.name}
                          </Tooltip>
                        )}
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                  case 'funding':
                    return (
                      <DialogTrigger>
                        <Button color="secondary">
                          {relationship.pending ? <LuClock /> : <LuCheck />}
                          Funder
                        </Button>
                        <Tooltip>
                          {relationship.pending &&
                            `Pending confirmation from ${profile.name}`}
                        </Tooltip>
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                  default:
                    return (
                      <DialogTrigger>
                        <Button color="secondary">
                          {relationship.pending ? <LuClock /> : <LuCheck />}
                          Member
                        </Button>
                        <Tooltip>
                          {relationship.pending &&
                            `Pending confirmation from ${profile.name}`}
                        </Tooltip>
                        <RemoveRelationshipModal
                          relationship={relationship}
                          onChange={() => {
                            utils.organization.listRelationships.invalidate({
                              organizationId: profile.id,
                            });
                            utils.organization.listDirectedRelationships.invalidate(
                              {
                                to: profile.id,
                              },
                            );
                          }}
                        />
                      </DialogTrigger>
                    );
                }
              })()}
            </TooltipTrigger>
          );
        })
      ) : (
        <DialogTrigger>
          <Button className="min-w-full sm:min-w-fit">
            <LuPlus className="size-4" />
            Add relationship
          </Button>
          <Modal className="min-w-[29rem]">
            <AddRelationshipForm
              profile={profile}
              onChange={() => {
                utils.organization.listRelationships.invalidate({
                  organizationId: profile.id,
                });
                utils.organization.listDirectedRelationships.invalidate({
                  to: profile.id,
                });
              }}
            />
          </Modal>
        </DialogTrigger>
      )}
    </>
  );
};

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
      <ErrorBoundary fallback={null}>
        <Suspense
          fallback={
            <Button isDisabled={true}>
              <LoadingSpinner />
            </Button>
          }
        >
          <AddRelationshipModal profile={profile} />
        </Suspense>
      </ErrorBoundary>

      {isReceivingFunds
        ? receivingFundingLinks.map((link) => (
            <TooltipTrigger key={link.id}>
              <ButtonLink
                color="secondary"
                href={link.href}
                className="min-w-full sm:min-w-fit"
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
                className="min-w-full sm:min-w-fit"
              >
                <LuInfo />
                Learn more
              </ButtonLink>
              <Tooltip>We’re an invite-only granting organization</Tooltip>
            </TooltipTrigger>
          ))
        : null}
    </div>
  );
};

export const ProfileDetails = ({ profile }: { profile: Organization }) => {
  return (
    <div className="flex w-full flex-col gap-3 px-4">
      <ProfileSummary profile={profile} />
      <div className="text-base text-neutral-charcoal">{profile.bio}</div>
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
