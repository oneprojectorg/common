'use client';

import { trpc } from '@op/api/client';
import type { Role } from '@op/api/encoders';
import type { DecisionRolePermissions } from '@op/common';
import { useDebouncedCallback, useMediaQuery } from '@op/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@op/sense/Empty';
import { Field, FieldLabel } from '@op/sense/Field';
import { Header2, Header3 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { toast } from '@op/sense/Toast';
import { screens } from '@op/styles/constants';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  LuCheck,
  LuEllipsis,
  LuLeaf,
  LuPencil,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';

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
    <div className="p-4 md:p-8">
      <div className="w-full">
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
          toast.error(t('Failed to update role'));
          utils.profile.listRoles.invalidate();
          onComplete();
          return;
        }
      }
      toast.success(t('Role created successfully'));
      utils.profile.listRoles.invalidate();
      onComplete();
    },
    onError: () => {
      toast.error(t('Failed to create role'));
    },
  });

  const updateRole = trpc.profile.updateRole.useMutation({
    onSuccess: () => {
      toast.success(t('Role updated successfully'));
      utils.profile.listRoles.invalidate();
      onComplete();
    },
    onError: () => {
      toast.error(t('Failed to update role'));
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
    <Input
      placeholder={t('Role name…')}
      value={roleName}
      onChange={(e) => onRoleNameChange(e.target.value)}
      autoFocus
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSave();
        }
        if (e.key === 'Escape') {
          onCancel();
        }
      }}
    />
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
      {/* TODO(sense-migration): @op/ui EditableCell has no @op/sense equivalent;
          its popover-overlay editor is replaced with an inline conditional (the
          edit input renders in-cell). Verify the edit UX. */}
      <TableCell className="w-48 p-2 text-base">
        {isEditing ? (
          <RoleNameForm
            roleName={roleName}
            onRoleNameChange={setRoleName}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          role.name
        )}
      </TableCell>
      <DecisionRoleCheckboxes roleId={role.id} profileId={profileId} />
      <TableCell className="w-22 p-2">
        <div className="flex gap-1">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleSave}
                disabled={!roleName.trim() || isPending}
                aria-label={t('Save role')}
                className="ms-auto"
              >
                <LuCheck className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => onDelete(role)}
                aria-label={t('Delete')}
              >
                <LuTrash2 className="size-4" />
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t('Role options')}
                    className="ms-auto"
                  >
                    <LuEllipsis className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <LuPencil className="size-4" />
                  {t('Edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(role)}
                >
                  <LuTrash2 className="size-4" />
                  {t('Delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Add role')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          <Field>
            <FieldLabel htmlFor="add-role-name">{t('Role name')}</FieldLabel>
            <Input
              id="add-role-name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit();
                }
              }}
            />
          </Field>
          <div className="flex flex-col gap-2 pt-2">
            {PERMISSION_COLUMNS.map(({ key, label }) => (
              <Field key={key} orientation="horizontal">
                <Checkbox
                  id={`add-perm-${key}`}
                  checked={permissions[key]}
                  onCheckedChange={() => togglePermission(key)}
                  aria-label={`${label} permission`}
                />
                <FieldLabel htmlFor={`add-perm-${key}`}>{t(label)}</FieldLabel>
              </Field>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!roleName.trim() || isPending}
          >
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <Header2 className="text-label font-light">
          {t('Roles & permissions')}
        </Header2>
        <Button
          variant="ghost"
          className="text-primary-teal hover:text-primary-tealBlack"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <LuPlus className="size-4" />
          {t('Add role')}
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="h-48 animate-pulse rounded-lg bg-secondary" />
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
              toast.error(t('Failed to update role'));
            } else {
              toast.success(t('Role updated successfully'));
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
    <TableCell key={key} className="p-0 text-center">
      <div className="flex justify-center">
        <Checkbox
          checked={optimisticPermissions?.[key] ?? false}
          onCheckedChange={() => togglePermission(key)}
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
        <Field key={key} orientation="horizontal">
          <Checkbox
            id={`mobile-perm-${roleId}-${key}`}
            checked={optimisticPermissions?.[key] ?? false}
            onCheckedChange={() => togglePermission(key)}
            aria-label={`${label} permission`}
          />
          <FieldLabel htmlFor={`mobile-perm-${roleId}-${key}`}>
            {t(label)}
          </FieldLabel>
        </Field>
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
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <Header3 className="font-serif text-base">{role.name}</Header3>
        {(onDelete || onEdit) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t('Role options')}
                >
                  <LuEllipsis className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(role)}>
                  <LuPencil className="size-4" />
                  {t('Edit')}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(role)}
                >
                  <LuTrash2 className="size-4" />
                  {t('Delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder={t('Role name…')}
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
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
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleSave}
          disabled={!roleName.trim() || isPending}
          aria-label={t('Save role')}
        >
          <LuCheck className="size-4" />
        </Button>
        {onDelete && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onDelete(role)}
            aria-label={t('Delete')}
            className="text-destructive"
          >
            <LuTrash2 className="size-4" />
          </Button>
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
      <TableCell className="w-36 p-2 text-base">
        <RoleNameForm
          roleName={roleName}
          onRoleNameChange={setRoleName}
          onSave={handleSave}
          onCancel={onComplete}
        />
      </TableCell>
      {PERMISSION_COLUMNS.map(({ key, label }) => (
        <TableCell key={key} className="p-0 text-center">
          <div className="flex justify-center">
            <Checkbox
              checked={permissions[key]}
              onCheckedChange={() => togglePermission(key)}
              aria-label={`${label} permission`}
            />
          </div>
        </TableCell>
      ))}
      <TableCell className="w-22 p-2">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleSave}
            disabled={!roleName.trim() || isPending}
            aria-label={t('Save role')}
            className="ms-auto"
          >
            <LuCheck className="size-4" />
          </Button>
        </div>
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
      toast.success(t('Role deleted successfully'));
      utils.profile.listRoles.invalidate();
      setRoleToDelete(null);
    },
    onError: () => {
      toast.error(t('Failed to delete role'));
    },
  });

  if (roles.length === 0 && !isAdding) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLeaf className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t('No roles configured')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
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
              <TableRow>
                <TableHead>{t('Role')}</TableHead>
                {PERMISSION_COLUMNS.map(({ key, label }) => (
                  <TableHead key={key} className="text-center">
                    {t(label)}
                  </TableHead>
                ))}
                <TableHead className="w-12" />
              </TableRow>
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

      <AlertDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {/* Email-only entries (no display name) would blow out the title,
                  so fall back to a generic title — the description still names
                  the member. */}
              {roleToDelete && /^\S+@\S+$/.test(roleToDelete.name)
                ? t('Remove member?')
                : t('Remove {name}', { name: roleToDelete?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to remove {roleName} from "{processName}"?',
                {
                  roleName: roleToDelete?.name ?? '',
                  processName: decisionName,
                },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? t('Removing...') : t('Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
