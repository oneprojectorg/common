import { trpc } from '@op/trpc/client';
import type { Organization } from '@op/trpc/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { ReactNode } from 'react';
import { LuArrowUpRight, LuInfo, LuPlus } from 'react-icons/lu';

import { ProfileSummary } from '../ProfileSummary';

const ModalForm = ({ profile }: { profile: Organization }) => {
  const addRelationship = trpc.organization.addRelationship.useMutation();

  return (
    <Dialog>
      {({ close }) => (
        <>
          <ModalHeader>Add relationship</ModalHeader>
          <ModalBody>
            <div>
              Choose how you’re in relationship with{' '}
              <span className="font-semibold">{profile.name}:</span>
              <ul>
                <li className="flex gap-3 py-2">
                  <Checkbox />
                  <div className="flex flex-col text-neutral-charcoal">
                    <span>Partnership</span>
                    <span className="text-sm text-neutral-gray4">
                      You’ve partnered with One Project on projects/programs
                    </span>
                  </div>
                </li>

                <li className="flex gap-3 py-2">
                  <Checkbox />
                  <div className="flex flex-col text-neutral-charcoal">
                    <span>Funding</span>
                    <span className="text-sm text-neutral-gray4">
                      You’ve either received or given funds to One Project
                    </span>
                  </div>
                </li>

                <li className="flex gap-3 py-2">
                  <Checkbox />
                  <div className="flex flex-col text-neutral-charcoal">
                    <span>Membership</span>
                    <span className="text-sm text-neutral-gray4">
                      Your organization is a member of One Project's network
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onPress={close} color="secondary">
              Cancel
            </Button>
            <Button
              onPress={() => {
                addRelationship.mutate({ to: profile.id });
                close();
              }}
            >
              Add
            </Button>
          </ModalFooter>
        </>
      )}
    </Dialog>
  );
};

const AddRelationshipModal = ({
  children,
  profile,
}: {
  children: ReactNode;
  profile: Organization;
}) => {
  return (
    <DialogTrigger>
      {children}
      <Modal className="min-w-[29rem]">
        <ModalForm profile={profile} />
      </Modal>
    </DialogTrigger>
  );
};

// onPress={() => addRelationship.mutate({ to: profile.id })}
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
      <AddRelationshipModal profile={profile}>
        <Button className="min-w-full sm:min-w-fit">
          <LuPlus className="size-4" />
          Add relationship
        </Button>
      </AddRelationshipModal>

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
      <div className="text-base text-neutral-charcoal">
        {profile.description}
      </div>
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
