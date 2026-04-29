'use client';

import { trpc } from '@op/api/client';
import type { Role } from '@op/api/encoders';
import type { DecisionRolePermissions } from '@op/common';
import { useDebouncedCallback, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { DialogTrigger } from '@op/ui/Dialog';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2, Header3 } from '@op/ui/Header';
import { IconButton } from '@op/ui/IconButton';
import { Menu, MenuItem } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { OptionMenu } from '@op/ui/OptionMenu';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import {
  EditableCell,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@op/ui/ui/data-table';
import { Suspense, useEffect, useRef, useState } from 'react';
import { LuCheck, LuLeaf, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

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

const DEFAULT_DECISION_PERMISSIONS: DecisionRolePermissions = {
  admin: false,
  create: false,
  read: false,
  update: false,
  delete: false,
  inviteMembers: false,
  review: false,
  submitProposals: false,
  vote: false,
};

function useNewRolePermissions() {
  const [permissions, setPermissions] = useState<DecisionRolePermissions>({
    ...DEFAULT_DECISION_PERMISSIONS,
  });

  const togglePermission = (key: DecisionRoleKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetPermissions = () => {
    setPermissions({ ...DEFAULT_DECISION_PERMISSIONS });
  };

  return { permissions, togglePermission, resetPermissions };
}

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

function useRoleMutation({
  role,
  profileId,
  onComplete,
}: {
  role?: Role;
  profileId: string;
  onComplete: () => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const pendingDecisionRolePermissions = useRef<DecisionRolePermissions | null>(
    null,
  );
  const updateDecisionRoles = trpc.profile.updateDecisionRoles.useMutation();

  const createRole = trpc.profile.createRole.useMutation({
    onSuccess: async (data) => {
      const decisionPermissions = pendingDecisionRolePermissions.current;
      pendingDecisionRolePermissions.current = null;
      if (
        decisionPermissions &&
        Object.values(decisionPermissions).some(Boolean)
      ) {
        try {
          await updateDecisionRoles.mutateAsync({
            roleId: data.id,
            decisionPermissions,
          });
        } catch {
          toast.error({ message: t('Failed to update role') });
          utils.profile.listRoles.invalidate();
          onComplete();
          return;
        }
      }
      toast.success({ message: t('Role created successfully') });
      utils.profile.listRoles.invalidate();
      onComplete();
    },
    onError: () => {
      toast.error({ message: t('Failed to create role') });
    },
  });

  const updateRole = trpc.profile.updateRole.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Role updated successfully') });
      utils.profile.listRoles.invalidate();
      onComplete();
    },
    onError: () => {
      toast.error({ message: t('Failed to update role') });
    },
  });

  const isPending =
    (role ? updateRole.isPending : createRole.isPending) ||
    updateDecisionRoles.isPending;

  const save = (
    name: string,
    decisionPermissions?: DecisionRolePermissions,
  ) => {
    if (isPending) {
      return;
    }
    if (role) {
      updateRole.mutate({ roleId: role.id, name });
    } else {
      pendingDecisionRolePermissions.current = decisionPermissions ?? null;
      createRole.mutate({
        profileId,
        zoneName: 'decisions',
        name,
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

  return { save, isPending };
}

function RoleNameForm({
  roleName,
  onRoleNameChange,
  onSave,
  onCancel,
}: {
  roleName: string;
  onRoleNameChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex h-full w-full items-center py-1.5">
      <TextField
        inputProps={{ placeholder: t('Role name…') }}
        value={roleName}
        onChange={onRoleNameChange}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave();
          }
          if (e.key === 'Escape') {
            onCancel();
          }
        }}
        fieldClassName="h-7"
        className="w-full"
      />
    </div>
  );
}

function RoleRow({
  role,
  profileId,
  onDelete,
}: {
  role: Role;
  profileId: string;
  onDelete: (role: Role) => void;
}) {
  const t = useTranslations();
  const [isEditing, setIsEditing] = useState(false);
  const [roleName, setRoleName] = useState(role.name);

  const { save, isPending } = useRoleMutation({
    role,
    profileId,
    onComplete: () => setIsEditing(false),
  });

  const handleSave = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      save(trimmed);
    }
  };

  const handleCancel = () => {
    setRoleName(role.name);
    setIsEditing(false);
  };

  return (
    <TableRow>
      <EditableCell
        className="w-36 text-base"
        isEditing={isEditing}
        onEditChange={(editing) => {
          if (!editing) {
            handleCancel();
          }
        }}
        renderEditing={() => (
          <RoleNameForm
            roleName={roleName}
            onRoleNameChange={setRoleName}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      >
        {role.name}
      </EditableCell>
      <DecisionRoleCheckboxes roleId={role.id} profileId={profileId} />
      <TableCell className="w-22">
        {isEditing ? (
          <div className="flex gap-1">
            <IconButton
              variant="outline"
              size="medium"
              onPress={handleSave}
              isDisabled={!roleName.trim() || isPending}
              aria-label={t('Save role')}
              className="ml-auto"
            >
              <LuCheck className="size-4" />
            </IconButton>
            <IconButton
              variant="outline"
              size="medium"
              onPress={() => onDelete(role)}
              aria-label={t('Delete')}
            >
              <LuTrash2 className="size-4" />
            </IconButton>
          </div>
        ) : (
          <OptionMenu
            variant="outline"
            className="ml-auto rounded bg-white shadow-light"
            size="medium"
          >
            <Menu className="min-w-28 p-2">
              <MenuItem key="edit" onAction={() => setIsEditing(true)}>
                <LuPencil className="size-4" />
                {t('Edit')}
              </MenuItem>
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
      </TableCell>
    </TableRow>
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
  const [roleName, setRoleName] = useState('');
  const { permissions, togglePermission, resetPermissions } =
    useNewRolePermissions();
  const { save, isPending } = useRoleMutation({
    profileId,
    onComplete: () => {
      setRoleName('');
      resetPermissions();
      onClose();
    },
  });

  const handleSubmit = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      save(trimmed, permissions);
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
          <div className="flex flex-col gap-2 pt-2">
            {PERMISSION_COLUMNS.map(({ key, label }) => (
              <Checkbox
                key={key}
                isSelected={permissions[key]}
                onChange={() => togglePermission(key)}
                aria-label={`${label} permission`}
              >
                {t(label)}
              </Checkbox>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onPress={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            onPress={handleSubmit}
            isDisabled={!roleName.trim() || isPending}
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
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Header2 className="font-serif text-title-sm font-light">
          {t('Roles & permissions')}
        </Header2>
        <Button
          color="ghost"
          className="text-primary-teal hover:text-primary-tealBlack"
          onPress={() => setIsAdding(true)}
          isDisabled={isAdding}
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
          isAdding={isAdding}
          onAddComplete={() => setIsAdding(false)}
        />
      </Suspense>
    </div>
  );
}

const DEBOUNCE_MS = 300;

function usePermissionToggle(roleId: string, profileId: string) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const { data: serverPermissions } = trpc.profile.getDecisionRole.useQuery({
    roleId,
    profileId,
  });

  // Local overlay: null = use server data, non-null = use local override
  const [localPermissions, setLocalPermissions] =
    useState<DecisionRolePermissions | null>(null);

  const localRef = useRef(localPermissions);
  localRef.current = localPermissions;
  const updatePermissions = trpc.profile.updateDecisionRoles.useMutation();

  const flush = useDebouncedCallback(
    () => {
      const toSend = localRef.current;
      if (!toSend) {
        return;
      }
      updatePermissions.mutate(
        { roleId, decisionPermissions: toSend },
        {
          onSettled: (_data, error) => {
            if (!flush.isPending()) {
              setLocalPermissions(null);
            }
            if (error) {
              toast.error({ message: t('Failed to update role') });
            } else {
              toast.success({ message: t('Role updated successfully') });
            }
            utils.profile.getDecisionRole.invalidate({ roleId, profileId });
          },
        },
      );
    },
    DEBOUNCE_MS,
    { leading: false, trailing: true },
  );

  // Flush pending changes on unmount so edits aren't lost on navigation
  useEffect(() => {
    return () => {
      flush.flush();
    };
  }, [flush]);

  const togglePermission = (key: DecisionRoleKey) => {
    const base = localPermissions ?? serverPermissions;
    if (!base) {
      return;
    }
    setLocalPermissions({ ...base, [key]: !base[key] });
    flush();
  };

  return {
    optimisticPermissions: localPermissions ?? serverPermissions ?? null,
    togglePermission,
  };
}

function DecisionRoleCheckboxes({
  roleId,
  profileId,
}: {
  roleId: string;
  profileId: string;
}) {
  const { optimisticPermissions, togglePermission } = usePermissionToggle(
    roleId,
    profileId,
  );

  return PERMISSION_COLUMNS.map(({ key, label }) => (
    <TableCell key={key} className="text-center">
      <div className="flex justify-center">
        <Checkbox
          isSelected={optimisticPermissions?.[key] ?? false}
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
}: {
  roleId: string;
  profileId: string;
}) {
  const t = useTranslations();
  const { optimisticPermissions, togglePermission } = usePermissionToggle(
    roleId,
    profileId,
  );

  return (
    <div className="flex flex-col gap-2">
      {PERMISSION_COLUMNS.map(({ key, label }) => (
        <Checkbox
          key={key}
          isSelected={optimisticPermissions?.[key] ?? false}
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
  profileId,
  onDelete,
  onEdit,
}: {
  role: Role;
  profileId: string;
  onDelete?: (role: Role) => void;
  onEdit?: (role: Role) => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-neutral-gray1 p-4">
      <div className="flex items-center justify-between">
        <Header3 className="font-serif text-sm font-light">{role.name}</Header3>
        {(onDelete || onEdit) && (
          <OptionMenu variant="outline" className="rounded-lg">
            <Menu className="min-w-28 p-2">
              {onEdit && (
                <MenuItem key="edit" onAction={() => onEdit(role)}>
                  <LuPencil className="size-4" />
                  {t('Edit')}
                </MenuItem>
              )}
              {onDelete && (
                <MenuItem
                  key="delete"
                  onAction={() => onDelete(role)}
                  className="text-functional-red"
                >
                  <LuTrash2 className="size-4" />
                  {t('Delete')}
                </MenuItem>
              )}
            </Menu>
          </OptionMenu>
        )}
      </div>

      <MobileDecisionRoles roleId={role.id} profileId={profileId} />
    </div>
  );
}

function MobileRoleFormCard({
  role,
  profileId,
  onComplete,
  onDelete,
}: {
  role: Role;
  profileId: string;
  onComplete: () => void;
  onDelete?: (role: Role) => void;
}) {
  const t = useTranslations();
  const [roleName, setRoleName] = useState(role.name);
  const { save, isPending } = useRoleMutation({
    role,
    profileId,
    onComplete,
  });

  const handleSave = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      save(trimmed);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-neutral-gray1 p-4">
      <div className="flex items-center justify-between gap-2">
        <TextField
          inputProps={{ placeholder: t('Role name…') }}
          value={roleName}
          onChange={setRoleName}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            }
            if (e.key === 'Escape') {
              onComplete();
            }
          }}
          className="flex-1"
          aria-label="Role name"
        />
        <IconButton
          variant="outline"
          size="medium"
          onPress={handleSave}
          isDisabled={!roleName.trim() || isPending}
          aria-label={t('Save role')}
        >
          <LuCheck className="size-4" />
        </IconButton>
        {onDelete && (
          <IconButton
            variant="ghost"
            size="medium"
            onPress={() => onDelete(role)}
            aria-label={t('Delete')}
            className="text-functional-red"
          >
            <LuTrash2 className="size-4" />
          </IconButton>
        )}
      </div>

      <MobileDecisionRoles roleId={role.id} profileId={profileId} />
    </div>
  );
}

function AddRoleRow({
  profileId,
  onComplete,
}: {
  profileId: string;
  onComplete: () => void;
}) {
  const t = useTranslations();
  const [roleName, setRoleName] = useState('');
  const { permissions, togglePermission } = useNewRolePermissions();

  const { save, isPending } = useRoleMutation({
    profileId,
    onComplete,
  });

  const handleSave = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      save(trimmed, permissions);
    }
  };

  return (
    <TableRow>
      <EditableCell
        className="w-36 text-base"
        isEditing
        renderEditing={() => (
          <RoleNameForm
            roleName={roleName}
            onRoleNameChange={setRoleName}
            onSave={handleSave}
            onCancel={onComplete}
          />
        )}
      >
        {null}
      </EditableCell>
      {PERMISSION_COLUMNS.map(({ key, label }) => (
        <TableCell key={key} className="text-center">
          <div className="flex justify-center">
            <Checkbox
              isSelected={permissions[key]}
              onChange={() => togglePermission(key)}
              aria-label={`${label} permission`}
            />
          </div>
        </TableCell>
      ))}
      <TableCell className="w-22">
        <IconButton
          variant="outline"
          size="medium"
          onPress={handleSave}
          isDisabled={!roleName.trim() || isPending}
          aria-label={t('Save role')}
          className="ml-auto"
        >
          <LuCheck className="size-4" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

function RolesTable({
  decisionProfileId,
  decisionName,
  isAdding,
  onAddComplete,
}: {
  decisionProfileId: string;
  decisionName: string;
  isAdding: boolean;
  onAddComplete: () => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);

  const [{ items: roles }] = trpc.profile.listRoles.useSuspenseQuery({
    profileId: decisionProfileId,
    zoneName: 'decisions',
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

  if (roles.length === 0 && !isAdding) {
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
          {roles.map((role) =>
            roleToEdit?.id === role.id ? (
              <MobileRoleFormCard
                key={role.id}
                role={role}
                profileId={decisionProfileId}
                onComplete={() => setRoleToEdit(null)}
                onDelete={setRoleToDelete}
              />
            ) : (
              <MobileRoleCard
                key={role.id}
                role={role}
                profileId={decisionProfileId}
                onDelete={setRoleToDelete}
                onEdit={setRoleToEdit}
              />
            ),
          )}
          <AddRoleDialog
            isOpen={isAdding}
            onClose={onAddComplete}
            profileId={decisionProfileId}
          />
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
              {roles.map((role) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  profileId={decisionProfileId}
                  onDelete={setRoleToDelete}
                />
              ))}
              {isAdding && (
                <AddRoleRow
                  profileId={decisionProfileId}
                  onComplete={onAddComplete}
                />
              )}
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
