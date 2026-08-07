'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Card } from '@op/sense/Card';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Label } from '@op/sense/Label';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Skeleton } from '@op/sense/Skeleton';
import { Spinner } from '@op/sense/Spinner';
import { toast } from '@op/sense/Toast';
import { FormEvent, Suspense, useMemo, useState, useTransition } from 'react';

import { useTranslations } from '@/lib/i18n';

import { OrganizationListItem } from '@/components/Organizations/OrganizationListItem';

import type { User } from './types';

type ComboboxOption = { value: string; label: string };

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <Suspense
          fallback={
            <div className="flex justify-center p-6">
              <Spinner className="size-6 text-primary" />
            </div>
          }
        >
          <AddUserToOrgModalContent user={user} onOpenChange={onOpenChange} />
        </Suspense>
      </DialogContent>
    </Dialog>
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
      toast.error(t('Please select both an organization and a role'));
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

        toast.success(t('User added to organization successfully'));

        utils.platform.admin.listAllUsers.invalidate();

        // Reset form
        setSelectedOrgId('');
        setSelectedRoleId('');
      } catch (error) {
        toast.error(t('Failed to add user to organization'));
      }
    });
  };

  const avatarUrl = user.avatarImage?.name
    ? (getPublicUrl(user.avatarImage.name) ?? undefined)
    : undefined;
  const userName = user.profile?.name ?? user.name ?? t('Unknown user');

  return (
    <form onSubmit={handleSubmit} className="contents">
      {/* Header */}
      <DialogHeader>
        <DialogTitle>{t('Add user to organization')}</DialogTitle>
      </DialogHeader>

      {/* Body */}
      <div className="flex flex-col gap-4 px-6 py-4">
        {/* User Info */}
        <div className="rounded-lg bg-muted p-4">
          <ProfileItem
            avatar={
              <Avatar size="lg">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={`${userName} avatar`} />
                ) : null}
                <AvatarFallback name={userName} />
              </Avatar>
            }
            title={userName}
            description={user.email ?? undefined}
          />
        </div>

        {/* Current Memberships */}
        {user.organizationUsers && user.organizationUsers.length > 0 ? (
          <>
            <div>
              <div className="mb-2 text-sm font-medium text-foreground">
                {t('Current organizations')}
              </div>
              <div className="space-y-2">
                {user.organizationUsers.map((orgUser) => {
                  if (!orgUser.organization?.profile) {
                    return null;
                  }

                  const roles =
                    orgUser.roles && orgUser.roles.length > 0
                      ? orgUser.roles.map((r) => r.accessRole.name)
                      : [t('No roles')];

                  return (
                    <Card key={orgUser.organizationId} className="gap-2 p-3">
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
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </OrganizationListItem>
                    </Card>
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
      </div>

      {/* Footer */}
      <DialogFooter>
        <Button
          type="submit"
          disabled={!selectedOrgId || !selectedRoleId || isSubmitting}
        >
          {isSubmitting ? <Spinner className="size-4" /> : null}
          {t('Add to organization')}
        </Button>
      </DialogFooter>
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

  // Filter out organizations user is already a member of
  const availableOrganizations = useMemo(() => {
    const userOrgIds = new Set(
      user.organizationUsers?.map((ou) => ou.organizationId) ?? [],
    );
    return organizationsData.items.filter((org) => !userOrgIds.has(org.id));
  }, [organizationsData.items, user.organizationUsers]);

  const orgItems: ComboboxOption[] = availableOrganizations.map((org) => ({
    value: org.id,
    label: org.profile.name,
  }));
  const orgById = new Map(availableOrganizations.map((org) => [org.id, org]));

  const roleItems: ComboboxOption[] = rolesData.roles.map((role) => ({
    value: role.id,
    label: role.name,
  }));
  const roleById = new Map(rolesData.roles.map((role) => [role.id, role]));

  return (
    <>
      {/* Organization Selection */}
      <div className="flex flex-col gap-2">
        <Label>{t('Select organization')}</Label>
        <Combobox
          items={orgItems}
          value={orgItems.find((item) => item.value === selectedOrgId) ?? null}
          onValueChange={(item: ComboboxOption | null) =>
            setSelectedOrgId(item?.value ?? '')
          }
          isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) =>
            a.value === b.value
          }
        >
          <ComboboxInput placeholder={t('Select organization')} />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxCollection>
                {(item: ComboboxOption) => {
                  const org = orgById.get(item.value);
                  if (!org) {
                    return null;
                  }
                  return (
                    <ComboboxItem key={item.value} value={item}>
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
                    </ComboboxItem>
                  );
                }}
              </ComboboxCollection>
              <ComboboxEmpty>{t('No organizations found')}</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {/* Role Selection */}
      <div className="flex flex-col gap-2">
        <Label>{t('Select role')}</Label>
        <Combobox
          items={roleItems}
          value={
            roleItems.find((item) => item.value === selectedRoleId) ?? null
          }
          onValueChange={(item: ComboboxOption | null) =>
            setSelectedRoleId(item?.value ?? '')
          }
          isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) =>
            a.value === b.value
          }
        >
          <ComboboxInput placeholder={t('Select role')} />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxCollection>
                {(item: ComboboxOption) => {
                  const role = roleById.get(item.value);
                  if (!role) {
                    return null;
                  }
                  return (
                    <ComboboxItem key={item.value} value={item}>
                      <div>
                        <div className="leading-base text-foreground">
                          {role.name}
                        </div>
                        {role.description ? (
                          <div className="text-xs text-muted-foreground">
                            {role.description}
                          </div>
                        ) : null}
                      </div>
                    </ComboboxItem>
                  );
                }}
              </ComboboxCollection>
              <ComboboxEmpty>{t('No roles found')}</ComboboxEmpty>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </>
  );
};
