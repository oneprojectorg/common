'use client';

import { getPublicUrl } from '@/utils';
import { useRequiredUser } from '@/utils/UserProvider';
import { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { match } from '@op/core';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldLabel } from '@op/sense/Field';
import { ProfileAvatar } from '@op/sense/ProfileAvatar';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { toast } from '@op/sense/Toast';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

// TODO: typing here needs to be fixed
type AccountProfile = RouterOutput['account']['getUserProfiles'][number];

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
  const [profileToDelete, setProfileToDelete] = useState<AccountProfile>();
  const [currentStep, setCurrentStep] = useState(0);

  const [isSubmitting, startTransition] = useTransition();
  const utils = trpc.useUtils();
  const { user } = useRequiredUser();
  const deleteProfile = trpc.organization.deleteOrganization.useMutation();
  const switchProfile = trpc.account.switchProfile.useMutation();

  const router = useRouter();

  const userProfiles =
    profiles?.filter(
      (profile) =>
        // Filter out everything that's not an ORG profile
        profile && profile?.type === EntityType.ORG,
    ) ?? [];

  const closeModal = () => {
    onOpenChange?.(false);
    setProfileToDelete(undefined);
    setCurrentStep(0);
  };

  const handleSubmit = () => {
    if (!selectedProfileId) {
      throw new Error('handleSubmit called without selectedProfileId');
    }
    startTransition(async () => {
      try {
        await deleteProfile.mutateAsync({
          organizationProfileId: selectedProfileId,
        });

        // Check if the deletedProfile is the user's current profile
        // if so, switch to the user's individual profile
        if (user.currentProfile?.id === selectedProfileId) {
          const personalProfile = profiles?.find(
            (profile) => profile.type === EntityType.INDIVIDUAL,
          );
          if (personalProfile) {
            await switchProfile.mutateAsync({ profileId: personalProfile.id });
          }
        }

        await utils.account.invalidate();
        await utils.organization.listAllPosts.invalidate();

        router.refresh();
        setCurrentStep(2);
      } catch (error) {
        toast.error(t('Failed to delete account'));
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
      key="select"
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
        key="confirm"
        submitButtonAction={handleSubmit}
        backButtonAction={() => setCurrentStep(0)}
        profileToDelete={profileToDelete}
        isSubmitting={isSubmitting}
      />
    ),
    profileToDelete && (
      <SuccessStep
        key="success"
        submitButtonAction={closeModal}
        deletedProfileName={profileToDelete.name}
      />
    ),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="text-start">{steps[currentStep]}</DialogContent>
    </Dialog>
  );
};

const SelectProfileStep = ({
  allProfiles,
  selectedProfile,
  setSelectedProfile,
  cancelButtonAction,
  submitButtonAction,
}: {
  allProfiles: AccountProfile[];
  selectedProfile?: string;
  setSelectedProfile: (profiles: string) => void;
  cancelButtonAction: () => void;
  submitButtonAction: () => void;
}) => {
  const t = useTranslations();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('Delete an Account')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 py-4">
        <p id="select-accounts-label">
          {t(
            "Please select the account you'd like to delete. This action cannot be undone.",
          )}
        </p>
        <RadioGroup
          aria-labelledby="select-accounts-label"
          value={selectedProfile ?? ''}
          onValueChange={(value) => setSelectedProfile(value ?? '')}
        >
          {allProfiles.map((profile) => {
            const profileType = match(profile.type, {
              org: t('Organization'),
              individual: t('Individual'),
            });
            const optionId = `delete-profile-${profile.id}`;

            return (
              <Field key={profile.id} orientation="horizontal" className="py-2">
                <RadioGroupItem id={optionId} value={profile.id} />
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={optionId} className="leading-[1.05]">
                    {profile.name}
                  </FieldLabel>
                  <p className="text-muted-foreground">{profileType}</p>
                </div>
              </Field>
            );
          })}
        </RadioGroup>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={cancelButtonAction}
          className="w-full sm:w-auto"
        >
          {t('Cancel')}
        </Button>
        <Button
          variant="destructive"
          type="button"
          onClick={submitButtonAction}
          disabled={!selectedProfile}
          className="w-full sm:w-auto"
        >
          {t('Remove')}
        </Button>
      </DialogFooter>
    </>
  );
};

const ConfirmProfileStep = ({
  submitButtonAction,
  backButtonAction,
  profileToDelete,
  isSubmitting,
}: {
  profileToDelete: AccountProfile;
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
      <DialogHeader>
        <DialogTitle>{t('Delete an Account')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2 px-6 py-4">
        <p>
          {t(
            'You are about to delete this account. This action cannot be undone.',
          )}
        </p>
        <div className="flex gap-2 rounded border border-destructive-muted p-4">
          <ProfileAvatar
            className="size-8 shrink-0"
            name={profileToDelete.name}
            src={getPublicUrl(avatarUrl)}
            alt={profileToDelete.name ?? t('User avatar')}
            imageRender={
              avatarUrl ? (
                <Image
                  src={getPublicUrl(avatarUrl) ?? ''}
                  fill
                  className="object-cover"
                  alt={profileToDelete.name ?? t('User avatar')}
                />
              ) : undefined
            }
          />
          <div className="flex flex-col">
            <p className="font-medium">{profileToDelete.name}</p>
            <p className="text-sm text-neutral-charcoal">{profileType}</p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          onClick={backButtonAction}
        >
          {t('Back')}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="destructive"
          type="button"
          onClick={submitButtonAction}
          loading={isSubmitting}
        >
          {isSubmitting ? t('Removing...') : t('Remove')}
        </Button>
      </DialogFooter>
    </>
  );
};

const SuccessStep = ({
  deletedProfileName,
  submitButtonAction,
}: {
  deletedProfileName: string;
  submitButtonAction: () => void;
}) => {
  const t = useTranslations();
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('Account Deleted')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2 px-6 py-4">
        <p>
          {t(
            '{profileName} has been deleted. All associated data have been permanently removed.',
            { profileName: deletedProfileName },
          )}
        </p>
      </div>
      <DialogFooter>
        <Button
          className="w-full sm:w-auto"
          type="button"
          onClick={submitButtonAction}
        >
          {t('Done')}
        </Button>
      </DialogFooter>
    </>
  );
};
