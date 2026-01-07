'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Profile } from '@op/api/encoders';
import { EntityType } from '@op/api/encoders';
import { match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Modal, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import { useEffect, useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

interface OrgDeletionModalProps {
  isOpen: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const DeleteOrganizationModal = ({
  isOpen,
  onOpenChange,
}: OrgDeletionModalProps) => {
  const t = useTranslations();
  const { data: profiles } = trpc.account.getUserProfiles.useQuery();
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [profileToDelete, setProfileToDelete] = useState<Profile>();
  const [currentStep, setCurrentStep] = useState(0);

  const deleteProfile = trpc.organization.deleteOrganization.useMutation();
  const [isSubmitting, startTransition] = useTransition();
  const utils = trpc.useUtils();

  const userProfiles =
    profiles?.reduce<Profile[]>((acc, profile) => {
      // Filter out everything that's not an ORG profile
      if (!profile || profile?.type !== EntityType.ORG) {
        return acc;
      }
      acc.push(profile as Profile);
      return acc;
    }, []) ?? [];

  const closeModal = () => {
    onOpenChange?.(false);
    setProfileToDelete(undefined);
    setCurrentStep(0);
  };

  const handleSubmit = () => {
    if (!selectedProfileId) {
      console.error('handleSubmit called without selectedProfileId');
      return;
    }
    startTransition(async () => {
      try {
        await deleteProfile.mutateAsync({
          organizationProfileId: selectedProfileId,
        });

        await utils.account.getUserProfiles.invalidate();
        setCurrentStep(2);
      } catch (error) {
        toast.error({ message: t('Failed to delete account') });
      }
    });
  };

  // Clear selections when closing modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedProfileId(undefined);
      setProfileToDelete(undefined);
      setCurrentStep(0);
    }
  }, [isOpen]);

  const steps = [
    <SelectProfileStep
      allProfiles={userProfiles}
      selectedProfile={selectedProfileId}
      setSelectedProfile={setSelectedProfileId}
      cancelButtonAction={closeModal}
      submitButtonAction={() => {
        setProfileToDelete(
          userProfiles.find((profile) => profile.id === selectedProfileId),
        );
        setCurrentStep(1);
      }}
    />,
    profileToDelete && (
      <ConfirmProfileStep
        submitButtonAction={handleSubmit}
        backButtonAction={() => setCurrentStep(0)}
        profileToDelete={profileToDelete}
        isSubmitting={isSubmitting}
      />
    ),
    <SuccessStep
      submitButtonAction={closeModal}
      deletedProfileName={profileToDelete?.name}
    />,
  ];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="text-left"
    >
      {steps[currentStep]}
    </Modal>
  );
};

const SelectProfileStep = ({
  allProfiles,
  selectedProfile,
  setSelectedProfile,
  cancelButtonAction,
  submitButtonAction,
}: {
  allProfiles: Profile[];
  selectedProfile?: string;
  setSelectedProfile: (profiles: string) => void;
  cancelButtonAction: () => void;
  submitButtonAction: () => void;
}) => {
  const t = useTranslations();
  return (
    <>
      <ModalHeader>{t('Delete an Account')}</ModalHeader>
      <div className="flex flex-col gap-4 px-6 py-4">
        <p id="select-accounts-label">
          {t(
            'Please select the account you’d like to delete. This action cannot be undone.',
          )}
        </p>
        <RadioGroup
          aria-labelledby="select-accounts-label"
          value={selectedProfile}
          onChange={setSelectedProfile}
        >
          {allProfiles.map((profile) => {
            const profileType = match(profile.type, {
              org: t('Organization'),
              individual: t('Individual'),
            });
            return (
              <Radio
                key={profile.id}
                // size="small"
                className="items-start py-2"
                value={profile.id}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-base leading-[1.05] text-neutral-charcoal">
                    {profile.name}
                  </span>
                  <p className="text-neutral-gray4">{profileType}</p>
                </div>
              </Radio>
            );
          })}
        </RadioGroup>
      </div>
      <ModalFooter>
        <Button
          color="neutral"
          onPress={cancelButtonAction}
          className="w-full sm:w-auto"
        >
          {t('Cancel')}
        </Button>
        <Button
          color="destructive"
          type="button"
          onPress={submitButtonAction}
          isDisabled={!selectedProfile}
          className="w-full sm:w-auto"
        >
          {t('Remove')}
        </Button>
      </ModalFooter>
    </>
  );
};

const ConfirmProfileStep = ({
  submitButtonAction,
  backButtonAction,
  profileToDelete,
  isSubmitting,
}: {
  profileToDelete: Profile;
  backButtonAction: () => void;
  submitButtonAction: () => void;
  isSubmitting: boolean;
}) => {
  const t = useTranslations();
  const profileType = match(profileToDelete.type, {
    org: t('Organization'),
    individual: t('Individual'),
  });
  const avatarUrl = profileToDelete.avatarImage?.name;
  return (
    <>
      <ModalHeader>{t('Delete an Account')}</ModalHeader>
      <div className="flex flex-col gap-2 px-6 py-4">
        <p>
          {t(
            'You are about to delete this account. This action cannot be undone.',
          )}
        </p>
        <div className="flex gap-2 rounded border border-red-100 p-4">
          <Avatar
            className="size-8 shrink-0"
            placeholder={profileToDelete.name ?? ''}
          >
            {avatarUrl ? (
              <Image
                src={getPublicUrl(avatarUrl) ?? ''}
                fill
                className="object-cover"
                alt={profileToDelete.name ?? 'User avatar'}
              />
            ) : null}
          </Avatar>
          <div className="flex flex-col">
            <p className="font-medium">{profileToDelete.name}</p>
            <p className="text-sm text-neutral-charcoal">{profileType}</p>
          </div>
        </div>
      </div>
      <ModalFooter>
        <Button
          className="w-full sm:w-auto"
          color="neutral"
          onPress={backButtonAction}
        >
          {t('Back')}
        </Button>
        <Button
          className="w-full sm:w-auto"
          color="destructive"
          type="button"
          onPress={submitButtonAction}
          isPending={isSubmitting}
          isDisabled={isSubmitting}
        >
          {isSubmitting ? t('Removing...') : t('Remove')}
        </Button>
      </ModalFooter>
    </>
  );
};

const SuccessStep = ({
  deletedProfileName,
  submitButtonAction,
}: {
  deletedProfileName?: string;
  submitButtonAction: () => void;
}) => {
  const t = useTranslations();
  return (
    <>
      <ModalHeader>{t('Account Deleted')}</ModalHeader>
      <div className="flex flex-col gap-2 px-6 py-4">
        <p>
          <strong>{deletedProfileName}</strong>{' '}
          {t(
            'has been deleted. All associated data have been permanently removed.',
          )}
        </p>
      </div>
      <ModalFooter>
        <Button
          className="w-full sm:w-auto"
          type="button"
          onPress={submitButtonAction}
        >
          {t('Done')}
        </Button>
      </ModalFooter>
    </>
  );
};
