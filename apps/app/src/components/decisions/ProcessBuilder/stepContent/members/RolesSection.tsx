'use client';

import { trpc } from '@op/api/client';
import type { Role } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { Menu, MenuItem } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { OptionMenu } from '@op/ui/OptionMenu';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/table';
import type { Permission } from 'access-zones';
import { Suspense, useState } from 'react';
import { LuChevronDown, LuLeaf, LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';

type PermissionKey = keyof Permission;

type DecisionCapabilityKey =
  | 'manageProcess'
  | 'inviteMembers'
  | 'review'
  | 'submitProposals'
  | 'vote';

const PERMISSION_COLUMNS: Array<{ key: PermissionKey; label: string }> = [
  { key: 'admin', label: 'Admin' },
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
];

const DECISION_CAPABILITY_COLUMNS: Array<{
  key: DecisionCapabilityKey;
  label: string;
}> = [
  { key: 'manageProcess', label: 'Manage Process' },
  { key: 'inviteMembers', label: 'Invite Members' },
  { key: 'review', label: 'Review' },
  { key: 'submitProposals', label: 'Submit Proposals' },
  { key: 'vote', label: 'Vote' },
];

export default function RolesSection({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  return (
    <div className="px-4 md:px-24 md:py-16">
      <div className="mx-auto max-w-5xl">
        <RolesSectionContent
          decisionProfileId={decisionProfileId}
          instanceId={instanceId}
          decisionName={decisionName}
        />
      </div>
    </div>
  );
}

function RolesSectionContent({
  decisionProfileId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-sm font-light text-neutral-black">
          {t('Roles & permissions')}
        </h2>
        <Button
          color="ghost"
          className="text-primary-teal hover:text-primary-tealBlack"
          onPress={() => setIsAddDialogOpen(true)}
        >
          <LuPlus className="size-4" />
          {t('Add role')}
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-lg bg-neutral-gray1" />
        }
      >
        <RolesTable
          decisionProfileId={decisionProfileId}
          decisionName={decisionName}
          zoneName="decisions"
        />
      </Suspense>

      <AddRoleDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        profileId={decisionProfileId}
      />
    </div>
  );
}

function DecisionCapabilityCheckboxes({
  roleId,
  profileId,
  isGlobal,
}: {
  roleId: string;
  profileId: string;
  isGlobal: boolean;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const { data: capabilities } = trpc.profile.getDecisionCapabilities.useQuery({
    roleId,
    profileId,
  });

  const updateCapabilities =
    trpc.profile.updateDecisionCapabilities.useMutation({
      onMutate: async ({ decisionPermissions }) => {
        await utils.profile.getDecisionCapabilities.cancel({
          roleId,
          profileId,
        });

        const previousData = utils.profile.getDecisionCapabilities.getData({
          roleId,
          profileId,
        });

        utils.profile.getDecisionCapabilities.setData(
          { roleId, profileId },
          decisionPermissions,
        );

        return { previousData };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousData) {
          utils.profile.getDecisionCapabilities.setData(
            { roleId, profileId },
            context.previousData,
          );
        }
        toast.error({ message: t('Failed to update role') });
      },
      onSuccess: () => {
        toast.success({ message: t('Role updated successfully') });
      },
      onSettled: () => {
        utils.profile.getDecisionCapabilities.invalidate({
          roleId,
          profileId,
        });
      },
    });

  const toggleCapability = (key: DecisionCapabilityKey) => {
    if (!capabilities || isGlobal) {
      return;
    }
    updateCapabilities.mutate({
      roleId,
      decisionPermissions: {
        ...capabilities,
        [key]: !capabilities[key],
      },
    });
  };

  return DECISION_CAPABILITY_COLUMNS.map(({ key, label }) => (
    <TableCell key={key} className="text-center">
      <div className="flex justify-center">
        <Checkbox
          size="small"
          isSelected={capabilities?.[key] ?? false}
          isDisabled={isGlobal}
          onChange={() => toggleCapability(key)}
          aria-label={`${label} permission`}
        />
      </div>
    </TableCell>
  ));
}

function MobileDecisionCapabilities({
  roleId,
  profileId,
  isGlobal,
}: {
  roleId: string;
  profileId: string;
  isGlobal: boolean;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const { data: capabilities } = trpc.profile.getDecisionCapabilities.useQuery({
    roleId,
    profileId,
  });

  const updateCapabilities =
    trpc.profile.updateDecisionCapabilities.useMutation({
      onMutate: async ({ decisionPermissions }) => {
        await utils.profile.getDecisionCapabilities.cancel({
          roleId,
          profileId,
        });
        const previousData = utils.profile.getDecisionCapabilities.getData({
          roleId,
          profileId,
        });
        utils.profile.getDecisionCapabilities.setData(
          { roleId, profileId },
          decisionPermissions,
        );
        return { previousData };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousData) {
          utils.profile.getDecisionCapabilities.setData(
            { roleId, profileId },
            context.previousData,
          );
        }
        toast.error({ message: t('Failed to update role') });
      },
      onSuccess: () => {
        toast.success({ message: t('Role updated successfully') });
      },
      onSettled: () => {
        utils.profile.getDecisionCapabilities.invalidate({
          roleId,
          profileId,
        });
      },
    });

  const toggleCapability = (key: DecisionCapabilityKey) => {
    if (!capabilities || isGlobal) {
      return;
    }
    updateCapabilities.mutate({
      roleId,
      decisionPermissions: {
        ...capabilities,
        [key]: !capabilities[key],
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {DECISION_CAPABILITY_COLUMNS.map(({ key, label }) => (
        <Checkbox
          key={key}
          size="small"
          isSelected={capabilities?.[key] ?? false}
          isDisabled={isGlobal}
          onChange={() => toggleCapability(key)}
          aria-label={`${label} permission`}
        >
          {t(label)}
        </Checkbox>
      ))}
    </div>
  );
}

function MobileRoleCard({
  role,
  isGlobal,
  profileId,
  onTogglePermission,
  onDelete,
}: {
  role: Role;
  isGlobal: boolean;
  profileId: string;
  onTogglePermission: (role: Role, key: PermissionKey) => void;
  onDelete?: (role: Role) => void;
}) {
  const t = useTranslations();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div
      className={`flex flex-col gap-4 rounded-md border border-neutral-gray1 p-4 ${isGlobal ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-light text-neutral-black">
          {role.name}
        </h3>
        {!isGlobal && onDelete && (
          <OptionMenu variant="outline" className="rounded-md">
            <Menu className="min-w-28 p-2">
              <MenuItem
                key="delete"
                onAction={() => onDelete(role)}
                className="text-functional-red"
              >
                <LuTrash2 className="size-4" />
                {t('Delete')}
              </MenuItem>
            </Menu>
          </OptionMenu>
        )}
      </div>

      <MobileDecisionCapabilities
        roleId={role.id}
        profileId={profileId}
        isGlobal={isGlobal}
      />

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-neutral-gray5 flex items-center gap-1 text-xs"
        >
          <LuChevronDown
            className={`size-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          />
          {t('Advanced permissions')}
        </button>
        {showAdvanced && (
          <div className="mt-2 flex flex-col gap-2">
            {PERMISSION_COLUMNS.map(({ key, label }) => (
              <Checkbox
                key={key}
                size="small"
                isSelected={role.permissions?.[key] ?? false}
                isDisabled={isGlobal}
                onChange={() => onTogglePermission(role, key)}
                aria-label={`${label} permission for ${role.name}`}
              >
                {t(label)}
              </Checkbox>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RolesTable({
  decisionProfileId,
  decisionName,
  zoneName,
}: {
  decisionProfileId: string;
  decisionName: string;
  zoneName: string;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [[{ items: globalRoles }, { items: profileRoles }]] =
    trpc.useSuspenseQueries((q) => [
      q.profile.listRoles({ zoneName }),
      q.profile.listRoles({
        profileId: decisionProfileId,
        zoneName,
      }),
    ]);

  const updatePermission = trpc.profile.updateRolePermission.useMutation({
    onMutate: async ({ roleId, permissions }) => {
      await utils.profile.listRoles.cancel({
        profileId: decisionProfileId,
        zoneName,
      });

      const previousData = utils.profile.listRoles.getData({
        profileId: decisionProfileId,
        zoneName,
      });

      utils.profile.listRoles.setData(
        { profileId: decisionProfileId, zoneName },
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            items: old.items.map((role) =>
              role.id === roleId ? { ...role, permissions } : role,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        utils.profile.listRoles.setData(
          { profileId: decisionProfileId, zoneName },
          context.previousData,
        );
      }
      toast.error({ message: t('Failed to update role') });
    },
    onSuccess: () => {
      toast.success({ message: t('Role updated successfully') });
    },
    onSettled: () => {
      utils.profile.listRoles.invalidate({
        profileId: decisionProfileId,
        zoneName,
      });
    },
  });

  const deleteRoleMutation = trpc.profile.deleteRole.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Role deleted successfully') });
      utils.profile.listRoles.invalidate();
      setRoleToDelete(null);
    },
    onError: () => {
      toast.error({ message: t('Failed to delete role') });
    },
  });

  const togglePermission = (role: Role, key: PermissionKey) => {
    const permissions = role.permissions ?? {
      admin: false,
      create: false,
      read: false,
      update: false,
      delete: false,
    };

    updatePermission.mutate({
      roleId: role.id,
      permissions: {
        ...permissions,
        [key]: !permissions[key],
      },
    });
  };

  if (globalRoles.length === 0 && profileRoles.length === 0) {
    return (
      <EmptyState icon={<LuLeaf className="size-6" />}>
        <span>{t('No roles configured')}</span>
      </EmptyState>
    );
  }

  const handleDeleteConfirm = () => {
    if (!roleToDelete) {
      return;
    }

    deleteRoleMutation.mutate({ roleId: roleToDelete.id });
  };

  return (
    <>
      {isMobile ? (
        <div className="flex flex-col gap-4">
          {globalRoles.map((role) => (
            <MobileRoleCard
              key={role.id}
              role={role}
              isGlobal
              profileId={decisionProfileId}
              onTogglePermission={togglePermission}
            />
          ))}
          {profileRoles.map((role) => (
            <MobileRoleCard
              key={role.id}
              role={role}
              isGlobal={false}
              profileId={decisionProfileId}
              onTogglePermission={togglePermission}
              onDelete={setRoleToDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Table aria-label={t('Roles & permissions')}>
            <TableHeader>
              <TableColumn isRowHeader>{t('Role')}</TableColumn>
              {DECISION_CAPABILITY_COLUMNS.map(({ key, label }) => (
                <TableColumn key={key} className="text-center">
                  {t(label)}
                </TableColumn>
              ))}
              <TableColumn className="w-12" />
            </TableHeader>
            <TableBody>
              {globalRoles.map((role) => (
                <TableRow key={role.id} className="opacity-50">
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <DecisionCapabilityCheckboxes
                    roleId={role.id}
                    profileId={decisionProfileId}
                    isGlobal
                  />
                  <TableCell />
                </TableRow>
              ))}
              {profileRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <DecisionCapabilityCheckboxes
                    roleId={role.id}
                    profileId={decisionProfileId}
                    isGlobal={false}
                  />
                  <TableCell>
                    <OptionMenu variant="outline" className="rounded-md">
                      <Menu className="min-w-28 p-2">
                        <MenuItem
                          key="delete"
                          onAction={() => setRoleToDelete(role)}
                          className="text-functional-red"
                        >
                          <LuTrash2 className="size-4" />
                          {t('Delete')}
                        </MenuItem>
                      </Menu>
                    </OptionMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-neutral-gray5 flex items-center gap-1 text-sm hover:text-neutral-black"
            >
              <LuChevronDown
                className={`size-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
              {t('Advanced permissions')}
            </button>
            {showAdvanced && (
              <div className="mt-4">
                <Table aria-label={t('Advanced permissions')}>
                  <TableHeader>
                    <TableColumn isRowHeader>{t('Role')}</TableColumn>
                    {PERMISSION_COLUMNS.map(({ key, label }) => (
                      <TableColumn key={key} className="text-center">
                        {t(label)}
                      </TableColumn>
                    ))}
                    <TableColumn className="w-12" />
                  </TableHeader>
                  <TableBody>
                    {globalRoles.map((role) => (
                      <TableRow key={role.id} className="opacity-50">
                        <TableCell className="font-medium">
                          {role.name}
                        </TableCell>
                        {PERMISSION_COLUMNS.map(({ key, label }) => (
                          <TableCell key={key} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                size="small"
                                isSelected={role.permissions?.[key] ?? false}
                                isDisabled
                                aria-label={`${label} permission for ${role.name}`}
                              />
                            </div>
                          </TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    ))}
                    {profileRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          {role.name}
                        </TableCell>
                        {PERMISSION_COLUMNS.map(({ key, label }) => (
                          <TableCell key={key} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                                size="small"
                                isSelected={role.permissions?.[key] ?? false}
                                onChange={() => togglePermission(role, key)}
                                aria-label={`${label} permission for ${role.name}`}
                              />
                            </div>
                          </TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      )}

      <DialogTrigger
        isOpen={roleToDelete !== null}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <Modal
          isDismissable
          isOpen={roleToDelete !== null}
          onOpenChange={(open) => !open && setRoleToDelete(null)}
        >
          <ModalHeader>
            {t('Remove {name}', { name: roleToDelete?.name ?? '' })}
          </ModalHeader>
          <ModalBody>
            <p>
              {t(
                'Are you sure you want to remove {roleName} from "{processName}"?',
                {
                  roleName: roleToDelete?.name ?? '',
                  processName: decisionName,
                },
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={() => setRoleToDelete(null)}>
              {t('Cancel')}
            </Button>
            <Button
              color="destructive"
              onPress={handleDeleteConfirm}
              isDisabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? t('Removing...') : t('Remove')}
            </Button>
          </ModalFooter>
        </Modal>
      </DialogTrigger>
    </>
  );
}

function AddRoleDialog({
  isOpen,
  onClose,
  profileId,
}: {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [roleName, setRoleName] = useState('');

  const createRole = trpc.profile.createRole.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Role created successfully') });
      utils.profile.listRoles.invalidate();
      setRoleName('');
      onClose();
    },
    onError: () => {
      toast.error({ message: t('Failed to create role') });
    },
  });

  const handleSubmit = () => {
    if (roleName.trim()) {
      createRole.mutate({
        profileId,
        zoneName: 'decisions',
        name: roleName.trim(),
        permissions: {
          admin: false,
          create: false,
          read: false,
          update: false,
          delete: false,
        },
      });
    }
  };

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal
        isDismissable
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <ModalHeader>{t('Add role')}</ModalHeader>
        <ModalBody>
          <TextField
            label={t('Role name')}
            value={roleName}
            onChange={setRoleName}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onPress={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            onPress={handleSubmit}
            isDisabled={!roleName.trim() || createRole.isPending}
          >
            {t('Save')}
          </Button>
        </ModalFooter>
      </Modal>
    </DialogTrigger>
  );
}
