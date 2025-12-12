'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Profile } from '@op/api/encoders';
import { match } from '@op/core';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Checkbox, CheckboxGroup } from '@op/ui/Checkbox';
import { Modal, ModalFooter, ModalHeader } from '@op/ui/Modal';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

interface OrgDeletionModalProps {
  isOpen: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const OrgDeletionModal = ({
  isOpen,
  onOpenChange,
}: OrgDeletionModalProps) => {
  const t = useTranslations();
  const { data: profiles } = trpc.account.getUserProfiles.useQuery();
  const [profilesToDelete, setProfilesToDelete] = useState<string[]>([]);
  const [showConfirmationStep, setShowConfirmationStep] = useState(false);

  const userProfiles =
    profiles?.reduce<Profile[]>((acc, profile) => {
      if (!profile) {
        return acc;
      }
      acc.push(profile as Profile);
      return acc;
    }, []) ?? [];

  const onCancel = () => {
    onOpenChange?.(false);
  };

  // Clear selections when closing modal
  useEffect(() => {
    if (!isOpen) {
      setProfilesToDelete([]);
      setShowConfirmationStep(false);
    }
  }, [isOpen, setProfilesToDelete]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="text-left"
    >
      {!showConfirmationStep && (
        <SelectProfilesToDelete
          allProfiles={userProfiles}
          selectedProfiles={profilesToDelete}
          setSelectedProfiles={setProfilesToDelete}
        />
      )}
      {showConfirmationStep && (
        <div>
          <ModalHeader>{t('Delete an Account')}</ModalHeader>
          <div className="flex flex-col gap-2 px-6 py-4">
            <p>{t('Delete these accounts? This action cannot be undone.')}</p>
            <ul className="flex flex-col gap-6 rounded bg-neutral-offWhite p-4">
              {profilesToDelete.map((profileId) => {
                const profile = userProfiles.find((p) => p.id === profileId);
                if (!profile) {
                  return null;
                }
                const profileType = match(profile.type, {
                  org: t('Organization'),
                  individual: t('Individual'),
                });
                const avatarUrl = profile.avatarImage?.name;
                return (
                  <li key={profileId} className="flex gap-2">
                    <Avatar
                      className="size-8 shrink-0"
                      placeholder={profile.name ?? ''}
                    >
                      {avatarUrl ? (
                        <Image
                          src={getPublicUrl(avatarUrl) ?? ''}
                          fill
                          className="object-cover"
                          alt={profile.name ?? 'User avatar'}
                        />
                      ) : null}
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-neutral-charcoal">
                        {profileType}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <ModalFooter className="sticky">
        <div className="flex flex-col-reverse items-stretch gap-4 sm:flex-row">
          {!showConfirmationStep ? (
            <>
              <Button
                color="neutral"
                onPress={onCancel}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                color="destructive"
                type="button"
                onPress={() => setShowConfirmationStep(true)}
                isDisabled={profilesToDelete.length === 0}
                className="w-full sm:w-auto"
              >
                Remove
              </Button>
            </>
          ) : (
            <>
              <Button
                className="w-full sm:w-auto"
                color="neutral"
                onPress={() => setShowConfirmationStep(false)}
              >
                Back
              </Button>
              <Button
                className="w-full sm:w-auto"
                color="destructive"
                type="button"
                onPress={() => console.log('DELETING!')}
                isDisabled={profilesToDelete.length === 0}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

const SelectProfilesToDelete = ({
  allProfiles,
  selectedProfiles,
  setSelectedProfiles,
}: {
  allProfiles: Profile[];
  selectedProfiles: string[];
  setSelectedProfiles: (profiles: string[]) => void;
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
        <CheckboxGroup
          aria-labelledby="select-accounts-label"
          value={selectedProfiles}
          onChange={setSelectedProfiles}
        >
          {allProfiles.map((profile) => {
            const profileType = match(profile.type, {
              org: t('Organization'),
              individual: t('Individual'),
            });
            return (
              <Checkbox
                key={profile.id}
                size="small"
                className="items-start py-2"
                value={profile.id}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-base leading-[1.05] text-neutral-charcoal">
                    {profile.name}
                  </span>
                  <p className="text-neutral-gray4">{profileType}</p>
                </div>
              </Checkbox>
            );
          })}
        </CheckboxGroup>
      </div>
    </>
  );
};
