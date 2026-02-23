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
import { Suspense, useOptimistic, useState, useTransition } from 'react';
import { LuLeaf, LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';

const PERMISSION_COLUMNS = [
  { key: 'admin', label: 'Manage Process' },
  { key: 'inviteMembers', label: 'Invite Members' },
  { key: 'review', label: 'Review' },
  { key: 'submitProposals', label: 'Submit Proposals' },
  { key: 'vote', label: 'Vote' },
] as const;

type DecisionRoleKey = (typeof PERMISSION_COLUMNS)[number]['key'];

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

function DecisionRoleCheckboxes({
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
  const [, startTransition] = useTransition();

  const { data: permissions } = trpc.profile.getDecisionRole.useQuery({
    roleId,
    profileId,
  });

  const [optimisticPermissions, setOptimisticPermissions] =
    useOptimistic(permissions);

  const updatePermissions = trpc.profile.updateDecisionRoles.useMutation();

  const togglePermission = (key: DecisionRoleKey) => {
    if (!permissions || isGlobal) {
      return;
    }
    const newPermissions = { ...permissions, [key]: !permissions[key] };
    startTransition(async () => {
      setOptimisticPermissions(newPermissions);
      try {
        await updatePermissions.mutateAsync({
          roleId,
          decisionPermissions: newPermissions,
        });
        toast.success({ message: t('Role updated successfully') });
      } catch {
        toast.error({ message: t('Failed to update role') });
      } finally {
        await utils.profile.getDecisionRole.invalidate({ roleId, profileId });
      }
    });
  };

  return PERMISSION_COLUMNS.map(({ key, label }) => (
    <TableCell key={key} className="text-center">
      <div className="flex justify-center">
        <Checkbox
          size="small"
          isSelected={optimisticPermissions?.[key] ?? false}
          isDisabled={isGlobal}
          onChange={() => togglePermission(key)}
          aria-label={`${label} permission`}
        />
      </div>
    </TableCell>
  ));
}

function MobileDecisionRoles({
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
  const [, startTransition] = useTransition();

  const { data: permissions } = trpc.profile.getDecisionRole.useQuery({
    roleId,
    profileId,
  });

  const [optimisticPermissions, setOptimisticPermissions] =
    useOptimistic(permissions);

  const updatePermissions = trpc.profile.updateDecisionRoles.useMutation();

  const togglePermission = (key: DecisionRoleKey) => {
    if (!permissions || isGlobal) {
      return;
    }
    const newPermissions = { ...permissions, [key]: !permissions[key] };
    startTransition(async () => {
      setOptimisticPermissions(newPermissions);
      try {
        await updatePermissions.mutateAsync({
          roleId,
          decisionPermissions: newPermissions,
        });
        toast.success({ message: t('Role updated successfully') });
      } catch {
        toast.error({ message: t('Failed to update role') });
      } finally {
        await utils.profile.getDecisionRole.invalidate({ roleId, profileId });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {PERMISSION_COLUMNS.map(({ key, label }) => (
        <Checkbox
          key={key}
          size="small"
          isSelected={optimisticPermissions?.[key] ?? false}
          isDisabled={isGlobal}
          onChange={() => togglePermission(key)}
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
  onDelete,
}: {
  role: Role;
  isGlobal: boolean;
  profileId: string;
  onDelete?: (role: Role) => void;
}) {
  const t = useTranslations();

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

      <MobileDecisionRoles
        roleId={role.id}
        profileId={profileId}
        isGlobal={isGlobal}
      />
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

  const [[{ items: globalRoles }, { items: profileRoles }]] =
    trpc.useSuspenseQueries((q) => [
      q.profile.listRoles({ zoneName }),
      q.profile.listRoles({
        profileId: decisionProfileId,
        zoneName,
      }),
    ]);

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
            />
          ))}
          {profileRoles.map((role) => (
            <MobileRoleCard
              key={role.id}
              role={role}
              isGlobal={false}
              profileId={decisionProfileId}
              onDelete={setRoleToDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Table aria-label={t('Roles & permissions')}>
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
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <DecisionRoleCheckboxes
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
                  <DecisionRoleCheckboxes
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
