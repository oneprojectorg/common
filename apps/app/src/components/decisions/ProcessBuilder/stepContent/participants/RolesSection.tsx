'use client';

import { ClientOnly } from '@/utils/ClientOnly';
import type { DecisionRolePermissions } from '@op/common';
import { useMediaQuery } from '@op/hooks';
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
import { Header1, Header3 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/sense/Table';
import { screens } from '@op/styles/constants';
import { eq, useLiveSuspenseQuery } from '@tanstack/react-db';
import { Suspense, useState } from 'react';
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
import type { RoleRecord } from './roleCollections';
import { useDecisionPermissionToggle } from './useDecisionPermissionToggle';
import { DEFAULT_DECISION_PERMISSIONS, useRoleActions } from './useRoleActions';
import { useRoleCollections } from './useRoleCollections';

const PERMISSION_COLUMNS = [
  { key: 'admin', label: 'Manage Process' },
  { key: 'inviteMembers', label: 'Invite Members' },
  { key: 'review', label: 'Review' },
  { key: 'submitProposals', label: 'Submit Proposals' },
  { key: 'developProposals', label: 'Develop Proposals' },
  { key: 'vote', label: 'Vote' },
] as const;

type DecisionRoleKey = (typeof PERMISSION_COLUMNS)[number]['key'];

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
      placeholder={t('decisions.processBuilder.roleNamePlaceholder')}
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
  decisionPermissions,
  profileId,
  onDelete,
}: {
  role: RoleRecord;
  decisionPermissions?: DecisionRolePermissions;
  profileId: string;
  onDelete: (role: RoleRecord) => void;
}) {
  const t = useTranslations();
  const [isEditing, setIsEditing] = useState(false);
  const [roleName, setRoleName] = useState(role.name);
  const { renameRole } = useRoleActions(profileId);

  const handleSave = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      renameRole({ roleId: role.id, name: trimmed });
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setRoleName(role.name);
    setIsEditing(false);
  };

  return (
    <TableRow>
      {/* TODO(sense-migration): the retired EditableCell has no @op/sense
          equivalent;
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
      <DecisionRoleCheckboxes
        role={role}
        decisionPermissions={decisionPermissions}
        profileId={profileId}
      />
      <TableCell className="w-22 p-2">
        <div className="flex gap-1">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleSave}
                disabled={!roleName.trim()}
                aria-label={t('decisions.processBuilder.saveRoleAction')}
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
                    aria-label={t('decisions.processBuilder.roleOptionsLabel')}
                    className="ms-auto"
                    disabled={role.isUnsaved}
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
  const { createRole } = useRoleActions(profileId);

  const handleSubmit = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      createRole({ name: trimmed, permissions });
      setRoleName('');
      resetPermissions();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('decisions.processBuilder.addRoleAction')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          <Field>
            <FieldLabel htmlFor="add-role-name">
              {t('decisions.processBuilder.roleNameLabel')}
            </FieldLabel>
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
          <Button onClick={handleSubmit} disabled={!roleName.trim()}>
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
  const tableFallback = (
    <div className="h-48 animate-pulse rounded-lg bg-secondary" />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Header1 className="text-headline">
          {t('decisions.processBuilder.rolesHeading')}
        </Header1>
        <Button
          variant="ghost"
          className="text-primary hover:text-teal-600"
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
        >
          <LuPlus className="size-4" />
          {t('decisions.processBuilder.addRoleAction')}
        </Button>
      </div>

      {/* TanStack DB collections do not render on the server. */}
      <ClientOnly fallback={tableFallback}>
        <Suspense fallback={tableFallback}>
          <RolesTable
            decisionProfileId={decisionProfileId}
            decisionName={decisionName}
            isAdding={isAdding}
            onAddComplete={() => setIsAdding(false)}
          />
        </Suspense>
      </ClientOnly>
    </div>
  );
}

function DecisionRoleCheckboxes({
  role,
  decisionPermissions,
  profileId,
}: {
  role: RoleRecord;
  decisionPermissions?: DecisionRolePermissions;
  profileId: string;
}) {
  const togglePermission = useDecisionPermissionToggle({
    roleId: role.id,
    profileId,
  });

  return PERMISSION_COLUMNS.map(({ key, label }) => (
    <TableCell key={key} className="p-0 text-center">
      <div className="flex justify-center">
        <Checkbox
          checked={decisionPermissions?.[key] ?? false}
          onCheckedChange={() => togglePermission(key)}
          disabled={role.isUnsaved}
          aria-label={`${label} permission`}
        />
      </div>
    </TableCell>
  ));
}

function MobileDecisionRoles({
  role,
  decisionPermissions,
  profileId,
}: {
  role: RoleRecord;
  decisionPermissions?: DecisionRolePermissions;
  profileId: string;
}) {
  const t = useTranslations();
  const togglePermission = useDecisionPermissionToggle({
    roleId: role.id,
    profileId,
  });

  return (
    <div className="flex flex-col gap-2">
      {PERMISSION_COLUMNS.map(({ key, label }) => (
        <Field key={key} orientation="horizontal">
          <Checkbox
            id={`mobile-perm-${role.id}-${key}`}
            checked={decisionPermissions?.[key] ?? false}
            onCheckedChange={() => togglePermission(key)}
            disabled={role.isUnsaved}
            aria-label={`${label} permission`}
          />
          <FieldLabel htmlFor={`mobile-perm-${role.id}-${key}`}>
            {t(label)}
          </FieldLabel>
        </Field>
      ))}
    </div>
  );
}

function MobileRoleCard({
  role,
  decisionPermissions,
  profileId,
  onDelete,
  onEdit,
}: {
  role: RoleRecord;
  decisionPermissions?: DecisionRolePermissions;
  profileId: string;
  onDelete?: (role: RoleRecord) => void;
  onEdit?: (role: RoleRecord) => void;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <Header3 className="text-base">{role.name}</Header3>
        {(onDelete || onEdit) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t('decisions.processBuilder.roleOptionsLabel')}
                  disabled={role.isUnsaved}
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

      <MobileDecisionRoles
        role={role}
        decisionPermissions={decisionPermissions}
        profileId={profileId}
      />
    </div>
  );
}

function MobileRoleFormCard({
  role,
  decisionPermissions,
  profileId,
  onComplete,
  onDelete,
}: {
  role: RoleRecord;
  decisionPermissions?: DecisionRolePermissions;
  profileId: string;
  onComplete: () => void;
  onDelete?: (role: RoleRecord) => void;
}) {
  const t = useTranslations();
  const [roleName, setRoleName] = useState(role.name);
  const { renameRole } = useRoleActions(profileId);

  const handleSave = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      renameRole({ roleId: role.id, name: trimmed });
      onComplete();
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder={t('decisions.processBuilder.roleNamePlaceholder')}
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
          disabled={!roleName.trim()}
          aria-label={t('decisions.processBuilder.saveRoleAction')}
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

      <MobileDecisionRoles
        role={role}
        decisionPermissions={decisionPermissions}
        profileId={profileId}
      />
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
  const { createRole } = useRoleActions(profileId);

  const handleSave = () => {
    const trimmed = roleName.trim();
    if (trimmed) {
      createRole({ name: trimmed, permissions });
      onComplete();
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
            disabled={!roleName.trim()}
            aria-label={t('decisions.processBuilder.saveRoleAction')}
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
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [roleToDelete, setRoleToDelete] = useState<RoleRecord | null>(null);
  const [roleToEdit, setRoleToEdit] = useState<RoleRecord | null>(null);

  const { deleteRole } = useRoleActions(decisionProfileId);
  const collections = useRoleCollections(decisionProfileId);
  const { data: rows } = useLiveSuspenseQuery((q) =>
    q
      .from({ role: collections.roles })
      .join(
        { access: collections.decisionPermissions },
        ({ role, access }) => eq(role.id, access.roleId),
        'left',
      )
      .orderBy(({ role }) => role.name),
  );

  if (rows.length === 0 && !isAdding) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LuLeaf className="size-6" />
          </EmptyMedia>
          <EmptyTitle>
            {t('decisions.processBuilder.noRolesConfigured')}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleDeleteConfirm = () => {
    if (!roleToDelete) {
      return;
    }

    deleteRole(roleToDelete.id);
    setRoleToDelete(null);
  };

  return (
    <>
      {isMobile ? (
        <div className="flex flex-col gap-4">
          {rows.map(({ role, access }) =>
            roleToEdit?.id === role.id ? (
              <MobileRoleFormCard
                key={role.id}
                role={role}
                decisionPermissions={access?.decisionPermissions}
                profileId={decisionProfileId}
                onComplete={() => setRoleToEdit(null)}
                onDelete={setRoleToDelete}
              />
            ) : (
              <MobileRoleCard
                key={role.id}
                role={role}
                decisionPermissions={access?.decisionPermissions}
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
          <Table aria-label={t('decisions.processBuilder.rolesHeading')}>
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
              {rows.map(({ role, access }) => (
                <RoleRow
                  key={role.id}
                  role={role}
                  decisionPermissions={access?.decisionPermissions}
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
                ? t('decisions.removeMemberTitle')
                : t('decisions.removeNamed', {
                    name: roleToDelete?.name ?? '',
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('decisions.processBuilder.removeRoleConfirm', {
                roleName: roleToDelete?.name ?? '',
                processName: decisionName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              {t('Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
