'use client';

import { useUser } from '@/utils/UserProvider';
import { skipBatch, trpc } from '@op/api/client';
import { Organization } from '@op/api/encoders';
import { relationshipMap } from '@op/types';
import { Button } from '@op/ui/Button';
import { DropDownButton } from '@op/ui/DropDownButton';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Dialog, DialogTrigger } from '@op/ui/RAC';
import { toast } from '@op/ui/Toast';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { FormEvent, Suspense, useState, useTransition } from 'react';
import { LuCheck, LuChevronDown, LuClock, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { OrganizationAvatar } from '@/components/OrganizationAvatar';

import { AddRelationshipForm } from './AddRelationshipForm';
import { RemoveRelationshipModal } from './RemoveRelationshipModal';
import { RespondButton } from './RespondButton';

const RemoveRelationshipModalContent = ({
  relationship,
  utils,
  profileId,
  onClose,
}: {
  relationship: any;
  utils: any;
  profileId: string;
  onClose: () => void;
}) => {
  const removeRelationship = trpc.organization.removeRelationship.useMutation();
  const [isSubmitting, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await removeRelationship.mutateAsync({
          id: relationship.id,
        });

        utils.organization.listRelationships.invalidate({
          organizationId: profileId,
        });
        utils.organization.listDirectedRelationships.invalidate({
          from: profileId,
        });

        toast.success({
          message: 'Relationship removed',
        });
        onClose();
      } catch (e) {
        toast.error({ message: 'Could not remove relationship' });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <ModalHeader>Remove relationship</ModalHeader>
      <ModalBody>
        <div>
          Are you sure you want to remove the {relationship.relationshipType}{' '}
          relationship?
        </div>
        <div>
          You'll need to send a new request to restore this relationship on your
          profile.
        </div>
      </ModalBody>
      <ModalFooter>
        <Button onPress={onClose} color="neutral" type="button">
          Cancel
        </Button>
        <Button color="destructive" type="submit" isPending={isSubmitting}>
          {isSubmitting ? <LoadingSpinner /> : 'Remove'}
        </Button>
      </ModalFooter>
    </form>
  );
};

export const AddRelationshipModalSuspense = ({
  profile,
}: {
  profile: Organization;
}) => {
  const { user } = useUser();
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<
    string | null
  >(null);

  // checking for our relationships TOWARDS the profile
  const [{ relationships }] =
    trpc.organization.listDirectedRelationships.useSuspenseQuery(
      {
        from: profile.id,
      },
      {
        ...skipBatch,
      },
    );

  const selectedRelationship = relationships.find(
    (r) => r.id === selectedRelationshipId,
  );

  const dropdownItems = relationships.map((relationship) => ({
    id: relationship.id,
    label:
      relationshipMap[relationship.relationshipType]?.label ??
      relationship.relationshipType,
    icon: relationship.pending ? (
      <LuClock className="size-4" />
    ) : (
      <LuCheck className="size-4" />
    ),
    onAction: () => setSelectedRelationshipId(relationship.id),
  }));

  return (
    <>
      <RespondButton profile={profile} />
      {relationships.length > 1 ? (
        <DropDownButton
          label={
            <>
              {`${relationships.length} relationship${relationships.length === 1 ? '' : 's'}`}{' '}
              {user.currentProfile ? (
                <>
                  with
                  <OrganizationAvatar
                    profile={user.currentProfile}
                    className="size-6"
                  />
                </>
              ) : null}
            </>
          }
          items={dropdownItems}
          chevronIcon={<LuChevronDown className="size-4" />}
          className={cn(
            'min-w-full sm:min-w-fit',
            relationships.some((r) => r.pending)
              ? 'bg-transparent'
              : 'bg-primary-tealWhite',
          )}
        />
      ) : relationships.length === 1 ? (
        relationships.map((relationship) => (
          <TooltipTrigger
            key={relationship.id}
            isDisabled={!relationship.pending}
          >
            <DialogTrigger>
              <Button
                className="w-full sm:w-auto"
                color={relationship.pending ? 'unverified' : 'verified'}
              >
                {relationship.pending ? (
                  <LuClock className="size-4" />
                ) : (
                  <LuCheck className="size-4" />
                )}
                {relationshipMap[relationship.relationshipType]?.label ??
                  relationship.relationshipType}
              </Button>
              {relationship.pending && (
                <Tooltip>
                  Pending confirmation from {profile.profile.name}
                </Tooltip>
              )}
              <RemoveRelationshipModal relationship={relationship} />
            </DialogTrigger>
          </TooltipTrigger>
        ))
      ) : (
        <DialogTrigger>
          <Button className="min-w-full text-nowrap sm:min-w-fit">
            <LuPlus className="size-4" />
            {t('Add relationship')}
          </Button>
          <Modal className="sm:min-w-[29rem]">
            <AddRelationshipForm
              profile={profile}
              onChange={() => {
                utils.organization.listRelationships.invalidate({
                  organizationId: profile.id,
                });
                utils.organization.listDirectedRelationships.invalidate({
                  from: profile.id,
                });
              }}
            />
          </Modal>
        </DialogTrigger>
      )}

      {selectedRelationship && (
        <Modal
          isOpen={true}
          onOpenChange={() => setSelectedRelationshipId(null)}
          className="sm:min-w-[29rem]"
        >
          <Dialog>
            {({ close }) => (
              <RemoveRelationshipModalContent
                relationship={selectedRelationship}
                utils={utils}
                profileId={profile.id}
                onClose={() => {
                  setSelectedRelationshipId(null);
                  close();
                }}
              />
            )}
          </Dialog>
        </Modal>
      )}
    </>
  );
};

export const AddRelationshipModal = ({
  profile,
}: {
  profile: Organization;
}) => {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense
        fallback={
          <Button isDisabled={true}>
            <LoadingSpinner />
          </Button>
        }
      >
        <AddRelationshipModalSuspense profile={profile} />
      </Suspense>
    </ErrorBoundary>
  );
};
