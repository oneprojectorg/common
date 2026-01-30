'use client';

import { trpc } from '@op/api/client';
import type { RoleWithPermissions } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { DialogTrigger } from '@op/ui/Dialog';
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
import { Suspense, useState } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';

const PERMISSION_COLUMNS = [
  { key: 'admin', label: 'Admin', mask: 16 },
  { key: 'create', label: 'Create', mask: 8 },
  { key: 'read', label: 'Read', mask: 4 },
  { key: 'update', label: 'Update', mask: 2 },
  { key: 'delete', label: 'Delete', mask: 1 },
] as const;

function RolesTable({
  decisionProfileId,
  decisionName,
}: {
  decisionProfileId: string;
  decisionName: string;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [roleToDelete, setRoleToDelete] = useState<RoleWithPermissions | null>(
    null,
  );

  const [rolesData] = trpc.profile.listRolesWithPermissions.useSuspenseQuery({
    profileId: decisionProfileId,
  });

  const globalRoles = rolesData.filter((role) => role.isGlobal);
  const profileRoles = rolesData.filter((role) => !role.isGlobal);

  const updatePermission = trpc.profile.updateRolePermission.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Role updated successfully') });
      utils.profile.listRolesWithPermissions.invalidate();
    },
    onError: () => {
      toast.error({ message: t('Failed to update role') });
    },
  });

  const deleteRoleMutation = trpc.profile.deleteRole.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Role deleted successfully') });
      utils.profile.listRolesWithPermissions.invalidate();
    },
    onError: () => {
      toast.error({ message: t('Failed to delete role') });
    },
  });

  const togglePermission = (role: RoleWithPermissions, mask: number) => {
    const currentlySet = (role.permission & mask) !== 0;
    const newPermission = currentlySet
      ? role.permission & ~mask
      : role.permission | mask;

    updatePermission.mutate({
      roleId: role.id,
      permission: newPermission,
    });
  };

  if (globalRoles.length === 0 && profileRoles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-gray2 p-8 text-center text-neutral-gray4">
        {t('No roles configured')}
      </div>
    );
  }

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) {
      return;
    }

    try {
      await deleteRoleMutation.mutateAsync({ roleId: roleToDelete.id });
      setRoleToDelete(null);
    } catch {
      // Error is handled by onError callback
    }
  };

  return (
    <>
      <Table aria-label={t('Roles & permissions')}>
        <TableHeader>
          <TableColumn isRowHeader>{t('Role')}</TableColumn>
          {PERMISSION_COLUMNS.map((col) => (
            <TableColumn key={col.key} className="text-center">
              {t(col.label)}
            </TableColumn>
          ))}
          <TableColumn className="w-12" />
        </TableHeader>
        <TableBody>
          {globalRoles.map((role) => (
            <TableRow key={role.id} className="opacity-50">
              <TableCell className="font-medium">{role.name}</TableCell>
              {PERMISSION_COLUMNS.map((col) => (
                <TableCell key={col.key} className="text-center">
                  <div className="flex justify-center">
                    <Checkbox
                      size="small"
                      isSelected={(role.permission & col.mask) !== 0}
                      isDisabled
                      aria-label={`${col.label} permission for ${role.name}`}
                    />
                  </div>
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          ))}
          {profileRoles.map((role) => (
            <TableRow key={role.id}>
              <TableCell className="font-medium">{role.name}</TableCell>
              {PERMISSION_COLUMNS.map((col) => (
                <TableCell key={col.key} className="text-center">
                  <div className="flex justify-center">
                    <Checkbox
                      size="small"
                      isSelected={(role.permission & col.mask) !== 0}
                      isDisabled={updatePermission.isPending}
                      onChange={() => togglePermission(role, col.mask)}
                      aria-label={`${col.label} permission for ${role.name}`}
                    />
                  </div>
                </TableCell>
              ))}
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
      utils.profile.listRolesWithPermissions.invalidate();
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
        name: roleName.trim(),
        permission: 0, // Start with no permissions
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

export default function RolesSection({
  decisionProfileId,
  decisionName,
}: SectionProps) {
  return (
    <div className="px-24 py-16">
      <div className="mx-auto max-w-5xl">
        <RolesSectionContent
          decisionProfileId={decisionProfileId}
          decisionName={decisionName}
        />
      </div>
    </div>
  );
}
