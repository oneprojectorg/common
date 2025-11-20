'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { Chip } from '@op/ui/Chip';
import { ComboBox, ComboBoxItem } from '@op/ui/ComboBox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
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
        message: 'Please select both an organization and a role',
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

        onOpenChange(false);

        toast.success({
          message: 'User successfully added to organization',
        });

        utils.platform.admin.listAllUsers.invalidate();

        // Reset form
        setSelectedOrgId('');
        setSelectedRoleId('');
      } catch (error) {
        toast.error({
          message: 'Failed to add user to organization',
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
      <ModalHeader>{t('Add User to Organization')}</ModalHeader>

      {/* Body */}
      <ModalBody className="space-y-4">
        {/* User Info */}
        <div className="bg-neutral-gray0 flex items-start gap-3 rounded-lg p-4">
          <Avatar
            placeholder={user.profile?.name ?? user.name ?? 'Unknown User'}
            className="size-10 shrink-0"
          >
            {avatarContent}
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-neutral-black">
              {user.profile?.name ?? user.name ?? 'Unknown User'}
            </div>
            <div className="text-sm text-neutral-charcoal">{user.email}</div>
          </div>
        </div>

        {/* Current Memberships */}
        {user.organizationUsers && user.organizationUsers.length > 0 ? (
          <>
            <div>
              <div className="mb-2 text-sm font-medium text-neutral-black">
                Current Organizations
              </div>
              <div className="space-y-2">
                {user.organizationUsers.map((orgUser) => {
                  if (!orgUser.organization?.profile) {
                    return null;
                  }

                  const roles =
                    orgUser.roles && orgUser.roles.length > 0
                      ? orgUser.roles.map((r) => r.accessRole.name)
                      : ['No roles'];

                  return (
                    <Surface
                      key={orgUser.organizationId}
                      className="flex flex-col gap-2 p-3"
                    >
                      <OrganizationListItem
                        organization={{
                          id: orgUser.organizationId,
                          profile: {
                            name: orgUser.organization.profile.name,
                            slug: orgUser.organization.profile.slug,
                            bio: orgUser.organization.profile.bio,
                          },
                          avatarImage: orgUser.organization.profile.avatarImage,
                          whereWeWork: orgUser.organization.whereWeWork ?? [],
                        }}
                        showBio={false}
                        avatarSize="sm"
                      />
                      <div className="flex gap-2">
                        {roles.map((role) => (
                          <Chip
                            key={role}
                            className="bg-teal-100 text-teal-800"
                          >
                            {role}
                          </Chip>
                        ))}
                      </div>
                    </Surface>
                  );
                })}
              </div>
            </div>
            <hr />
          </>
        ) : null}

        {/* Dynamic Form Fields - Suspense Boundary */}
        <Suspense fallback={<FormFieldsSkeleton />}>
          <DynamicFormFields
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
          isDisabled={!selectedOrgId || !selectedRoleId}
        >
          {isSubmitting ? <LoadingSpinner /> : 'Add to Organization'}
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
 * Dynamic form fields that require data fetching
 * Isolated to minimize the Suspense boundary
 */
const DynamicFormFields = ({
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
        label={t('Organization')}
        selectedKey={selectedOrgId}
        onSelectionChange={(key) => setSelectedOrgId(String(key))}
        items={availableOrganizations}
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
              showBio={false}
              avatarSize="sm"
            />
          </ComboBoxItem>
        )}
      </ComboBox>

      {/* Role Selection */}
      <ComboBox
        label={t('Role')}
        selectedKey={selectedRoleId}
        onSelectionChange={(key) => setSelectedRoleId(String(key))}
        defaultSelectedKey={memberRole?.id}
        items={rolesData.roles}
      >
        {(role) => (
          <ComboBoxItem key={role.id} id={role.id} textValue={role.name}>
            <div>
              <div className="text-sm font-medium">{role.name}</div>
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
