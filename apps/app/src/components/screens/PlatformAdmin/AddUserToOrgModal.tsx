'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import { ComboBox, ComboBoxItem } from '@op/ui/ComboBox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { ProfileItem } from '@op/ui/ProfileItem';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import {
  FormEvent,
  ReactNode,
  Suspense,
  useMemo,
  useState,
  useTransition,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import { OrganizationListItem } from '@/components/Organizations/OrganizationListItem';

import type { User } from './types';

/**
 * Modal to add a user to an organization with a specific role
 */
export const AddUserToOrgModal = ({
  user,
  isOpen,
  onOpenChange,
}: {
  user: User;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Suspense
        fallback={
          <div className="p-6">
            <LoadingSpinner />
          </div>
        }
      >
        <AddUserToOrgModalContent user={user} onOpenChange={onOpenChange} />
      </Suspense>
    </Modal>
  );
};

const AddUserToOrgModalContent = ({
  user,
  onOpenChange,
}: {
  user: User;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [isSubmitting, startTransition] = useTransition();

  const addUserToOrg = trpc.platform.admin.addUsersToOrganization.useMutation();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!selectedOrgId || !selectedRoleId) {
      toast.error({
        message: t('platformAdmin_addUserToOrg_errorSelectBoth'),
      });
      return;
    }

    startTransition(async () => {
      try {
        await addUserToOrg.mutateAsync({
          organizationId: selectedOrgId,
          users: [
            {
              authUserId: user.authUserId,
              roleId: selectedRoleId,
            },
          ],
        });

        // TODO: testing invalidation
        // onOpenChange(false);

        toast.success({
          message: t('platformAdmin_addUserToOrg_successMessage'),
        });

        // TODO: testing without invalidation
        // utils.platform.admin.listAllUsers.invalidate();

        // Reset form
        setSelectedOrgId('');
        setSelectedRoleId('');
      } catch (error) {
        toast.error({
          message: t('platformAdmin_addUserToOrg_errorMessage'),
        });
      }
    });
  };

  const avatarContent: ReactNode = user.avatarImage?.name ? (
    <Image
      src={getPublicUrl(user.avatarImage.name) ?? ''}
      alt={`${user.profile?.name ?? user.name} avatar`}
      fill
      className="object-cover"
    />
  ) : null;

  return (
    <form onSubmit={handleSubmit} className="contents">
      {/* Header */}
      <ModalHeader>{t('platformAdmin_addUserToOrg_modalTitle')}</ModalHeader>

      {/* Body */}
      <ModalBody className="space-y-4">
        {/* User Info */}
        <div className="bg-neutral-gray0 rounded-lg p-4">
          <ProfileItem
            avatar={
              <Avatar
                placeholder={
                  user.profile?.name ??
                  user.name ??
                  t('platformAdmin_addUserToOrg_unknownUser')
                }
                className="size-10 shrink-0"
              >
                {avatarContent}
              </Avatar>
            }
            title={
              user.profile?.name ??
              user.name ??
              t('platformAdmin_addUserToOrg_unknownUser')
            }
            description={user.email}
          />
        </div>

        {/* Current Memberships */}
        {user.organizationUsers && user.organizationUsers.length > 0 ? (
          <>
            <div>
              <div className="mb-2 text-sm font-medium text-neutral-black">
                {t('platformAdmin_addUserToOrg_currentOrganizations')}
              </div>
              <div className="space-y-2">
                {user.organizationUsers.map((orgUser) => {
                  if (!orgUser.organization?.profile) {
                    return null;
                  }

                  const roles =
                    orgUser.roles && orgUser.roles.length > 0
                      ? orgUser.roles.map((r) => r.accessRole.name)
                      : [t('platformAdmin_addUserToOrg_noRoles')];

                  return (
                    <Surface
                      key={orgUser.organizationId}
                      className="flex flex-col gap-2 p-3"
                    >
                      <OrganizationListItem
                        organization={{
                          id: orgUser.organizationId,
                          profile: orgUser.organization.profile,
                          avatarImage: orgUser.organization.profile.avatarImage,
                          whereWeWork: orgUser.organization.whereWeWork ?? [],
                        }}
                      >
                        <div className="mt-2 flex gap-2">
                          {roles.map((role) => (
                            <Chip key={role}>{role}</Chip>
                          ))}
                        </div>
                      </OrganizationListItem>
                    </Surface>
                  );
                })}
              </div>
            </div>
            <hr />
          </>
        ) : null}

        {/* Organization and Role Selection */}
        <Suspense fallback={<FormFieldsSkeleton />}>
          <OrganizationAndRoleSelection
            user={user}
            selectedOrgId={selectedOrgId}
            setSelectedOrgId={setSelectedOrgId}
            selectedRoleId={selectedRoleId}
            setSelectedRoleId={setSelectedRoleId}
          />
        </Suspense>
      </ModalBody>

      {/* Footer */}
      <ModalFooter>
        <Button
          color="primary"
          type="submit"
          isPending={isSubmitting}
          isDisabled={!selectedOrgId || !selectedRoleId || isSubmitting}
        >
          <div className="flex gap-2">
            {isSubmitting ? <LoadingSpinner /> : null}
            {t('platformAdmin_addUserToOrg_submitButton')}
          </div>
        </Button>
      </ModalFooter>
    </form>
  );
};

/**
 * Skeleton for form fields while loading
 */
const FormFieldsSkeleton = () => {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
    </>
  );
};

/**
 * Form fields for selecting organization and role with data fetching
 */
const OrganizationAndRoleSelection = ({
  user,
  selectedOrgId,
  setSelectedOrgId,
  selectedRoleId,
  setSelectedRoleId,
}: {
  user: User;
  selectedOrgId: string;
  setSelectedOrgId: (id: string) => void;
  selectedRoleId: string;
  setSelectedRoleId: (id: string) => void;
}) => {
  const t = useTranslations();

  const [[organizationsData, rolesData]] = trpc.useSuspenseQueries((t) => [
    t.organization.list({
      // TODO: because we lack a proper search/filter UI at this point, we set a high limit here. To be changed.
      limit: 500,
    }),
    t.organization.getRoles(),
  ]);

  // Find Member role and set as default
  const memberRole = rolesData.roles.find((role) => role.name === 'Member');

  // Filter out organizations user is already a member of
  const availableOrganizations = useMemo(() => {
    const userOrgIds = new Set(
      user.organizationUsers?.map((ou) => ou.organizationId) ?? [],
    );
    return organizationsData.items.filter((org) => !userOrgIds.has(org.id));
  }, [organizationsData.items, user.organizationUsers]);

  return (
    <>
      {/* Organization Selection */}
      <ComboBox
        label={t('platformAdmin_addUserToOrg_selectOrganization')}
        selectedKey={selectedOrgId}
        onSelectionChange={(key) => setSelectedOrgId(String(key))}
        items={availableOrganizations}
        popoverProps={{ className: 'max-w-md' }}
      >
        {(org) => (
          <ComboBoxItem key={org.id} id={org.id} textValue={org.profile.name}>
            <OrganizationListItem
              organization={{
                id: org.id,
                profile: {
                  name: org.profile.name,
                  slug: org.profile.slug,
                  bio: org.profile.bio,
                },
                avatarImage: org.avatarImage,
                whereWeWork: org.whereWeWork,
              }}
            />
          </ComboBoxItem>
        )}
      </ComboBox>

      {/* Role Selection */}
      <ComboBox
        label={t('platformAdmin_addUserToOrg_selectRole')}
        selectedKey={selectedRoleId}
        onSelectionChange={(key) => setSelectedRoleId(String(key))}
        defaultSelectedKey={memberRole?.id}
        items={rolesData.roles}
      >
        {(role) => (
          <ComboBoxItem key={role.id} id={role.id} textValue={role.name}>
            <div>
              <div className="leading-base text-neutral-black">{role.name}</div>
              {role.description && (
                <div className="text-xs text-neutral-charcoal">
                  {role.description}
                </div>
              )}
            </div>
          </ComboBoxItem>
        )}
      </ComboBox>
    </>
  );
};
