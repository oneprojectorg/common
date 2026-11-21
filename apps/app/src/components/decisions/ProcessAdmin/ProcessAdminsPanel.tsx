'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useMaybeUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import type { ProfileInvite, ProfileSearchResult } from '@op/api/encoders';
import { PAGE_LIMIT, type ProfileUser, hasEmail } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Skeleton } from '@op/sense/Skeleton';
import { Spinner } from '@op/sense/Spinner';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import {
  type ComponentProps,
  type ReactNode,
  type RefObject,
  Suspense,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LuEllipsisVertical, LuSearch, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProfileAvatar } from '@/components/ProfileAvatar';

import { isValidEmail } from '../emailUtils';
import {
  type AdminPickerOption,
  canRemoveAdmin,
  findAdminRole,
  getAdminPickAction,
  getAdminRemoveAction,
} from './processAdminActions';

interface ProcessAdminsPanelProps {
  profileId: string;
}

type PickerOption = AdminPickerOption<ProfileSearchResult>;

interface PendingAdmin {
  /** The picked email, lowercased. */
  key: string;
  /** The row to show, known once the lookup says which list the pick joins. */
  row?: PendingMember | PendingInvite;
}

interface PendingMember {
  list: 'admins';
  member: ProfileUser;
}

interface PendingInvite {
  list: 'invites';
  option: PickerOption;
  movedInvite?: ProfileInvite;
}

export function ProcessAdminsPanel({ profileId }: ProcessAdminsPanelProps) {
  const t = useTranslations('decisions.processAdmin');

  return (
    <APIErrorBoundary
      fallbacks={{
        default: () => (
          <p role="alert" className="text-sm text-muted-foreground">
            {t('adminsLoadError')}
          </p>
        ),
      }}
    >
      <Suspense fallback={<ProcessAdminsPanelSkeleton />}>
        <ProcessAdminsPanelSuspense profileId={profileId} />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ProcessAdminsPanelSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function ProcessAdminsPanelSuspense({ profileId }: ProcessAdminsPanelProps) {
  const t = useTranslations('decisions.processAdmin');
  const [roles] = trpc.profile.listRoles.useSuspenseQuery({
    profileId,
    zoneName: 'decisions',
  });
  const adminRole = findAdminRole(roles.items);

  if (!adminRole) {
    return (
      <p className="text-sm text-muted-foreground">{t('adminRoleMissing')}</p>
    );
  }

  return <AdminsList profileId={profileId} roleId={adminRole.id} />;
}

function AdminsList({
  profileId,
  roleId,
}: {
  profileId: string;
  roleId: string;
}) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();
  const [[{ items: admins }, allInvites]] = trpc.useSuspenseQueries((t) => [
    t.profile.listUsers({ profileId, roleId, limit: PAGE_LIMIT.max }),
    t.profile.listProfileInvites({ profileId }),
  ]);
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const focusPicker = () => pickerInputRef.current?.focus();
  const adminInvites = useMemo(
    () => allInvites.items.filter((invite) => invite.accessRoleId === roleId),
    [allInvites, roleId],
  );
  const confirmedEmails = useMemo(
    () =>
      new Set([
        ...admins.filter(hasEmail).map((admin) => admin.email.toLowerCase()),
        ...adminInvites.map((invite) => invite.email.toLowerCase()),
      ]),
    [admins, adminInvites],
  );
  // A confirmed row can land before its grant settles; never show both.
  const unconfirmed = pendingAdmins.filter(
    ({ key }) => !confirmedEmails.has(key),
  );
  const pendingMembers = unconfirmed.flatMap(({ key, row }) =>
    row?.list === 'admins' ? [{ key, member: row.member }] : [],
  );
  const pendingInvites = unconfirmed.flatMap(({ key, row }) =>
    row?.list === 'invites' ? [{ key, ...row }] : [],
  );
  const takenEmails = useMemo(
    () => new Set([...confirmedEmails, ...pendingAdmins.map(({ key }) => key)]),
    [confirmedEmails, pendingAdmins],
  );

  const invite = trpc.profile.invite.useMutation();
  const promote = trpc.profile.updateUserRoles.useMutation();
  const moveInvite = trpc.profile.updateProfileInvite.useMutation();

  const handlePick = async (option: PickerOption) => {
    const key = option.email.toLowerCase();
    const showPending = (row: PendingAdmin['row']) =>
      setPendingAdmins((current) =>
        current.map((pending) =>
          pending.key === key ? { key, row } : pending,
        ),
      );
    const name = getOptionLabel(option);
    // Reserves the email at once; the row waits for the lookup so it appears where it will stay.
    setPendingAdmins((current) => [...current, { key }]);

    try {
      // A member already in the process is promoted, not invited again; the
      // lookup asks the server, since a process can outgrow one page of members.
      const { items: matches } = await utils.client.profile.listUsers.query({
        profileId,
        query: option.email,
        limit: PAGE_LIMIT.max,
      });
      const action = getAdminPickAction({
        option,
        members: matches,
        invites: allInvites.items,
        roleId,
      });
      switch (action.kind) {
        case 'promote':
          showPending({ list: 'admins', member: action.member });
          await promote.mutateAsync({
            profileUserId: action.member.id,
            roleIds: action.roleIds,
          });
          toast.success(t.rich('adminAdded', { name, bdi }));
          break;
        case 'moveInvite':
          showPending({ list: 'invites', option, movedInvite: action.invite });
          await moveInvite.mutateAsync({
            inviteId: action.invite.id,
            accessRoleId: roleId,
          });
          toast.success(
            t.rich('inviteMovedToAdmin', { email: option.email, bdi }),
          );
          break;
        case 'invite': {
          showPending({ list: 'invites', option });
          const result = await invite.mutateAsync({
            profileId,
            invitations: [{ email: action.email, roleId }],
          });
          if (result.details.failed.length > 0) {
            toast.error(t.rich('inviteFailed', { email: option.email, bdi }));
          } else {
            toast.success(t.rich('inviteSent', { email: option.email, bdi }));
          }
        }
      }
      // Hold the pending row until the lists carry the confirmed one.
      await Promise.all([
        utils.profile.listUsers.invalidate({ profileId }),
        utils.profile.listProfileInvites.invalidate({ profileId }),
      ]);
    } catch (error) {
      logger.error('Process admin grant failed', { error });
      toast.error(t.rich('inviteFailed', { email: option.email, bdi }));
    } finally {
      setPendingAdmins((current) =>
        current.filter((pending) => pending.key !== key),
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <AdminPicker
        inputRef={pickerInputRef}
        takenEmails={takenEmails}
        onPick={(option) => void handlePick(option)}
      />
      <ul className="flex flex-col divide-y border-t">
        {slotPending(admins, pendingMembers, (pending, admin) =>
          compareMembers(pending.member, admin),
        ).map((row) =>
          'confirmed' in row ? (
            <AdminRow
              key={row.confirmed.id}
              admin={row.confirmed}
              profileId={profileId}
              roleId={roleId}
              adminCount={admins.length}
              onRemoved={focusPicker}
            />
          ) : (
            <PendingMemberRow
              key={row.pending.key}
              member={row.pending.member}
            />
          ),
        )}
        {slotPending(adminInvites, pendingInvites, (pending, confirmed) =>
          inServerOrder(pending.key, confirmed.email),
        ).map((row) =>
          'confirmed' in row ? (
            <InviteRow
              key={row.confirmed.id}
              invite={row.confirmed}
              profileId={profileId}
              onRemoved={focusPicker}
            />
          ) : (
            <PendingInviteRow key={row.pending.key} pending={row.pending} />
          ),
        )}
      </ul>
    </div>
  );
}

/** Slots pending rows into a server-ordered list at the place the server will give them. */
function slotPending<Confirmed, Pending>(
  confirmed: Confirmed[],
  pending: Pending[],
  compare: (pending: Pending, confirmed: Confirmed) => number,
) {
  const rows: ({ confirmed: Confirmed } | { pending: Pending })[] =
    confirmed.map((row) => ({ confirmed: row }));
  for (const row of pending) {
    const at = rows.findIndex(
      (other) => 'confirmed' in other && compare(row, other.confirmed) < 0,
    );
    rows.splice(at === -1 ? rows.length : at, 0, { pending: row });
  }
  return rows;
}

const inServerOrder = (a: string, b: string) => a.localeCompare(b, 'en');

const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

const getOptionLabel = (option: PickerOption) =>
  option.kind === 'person' ? option.result.name : option.email;

/** The members list comes back by name, then email. */
const compareMembers = (a: ProfileUser, b: ProfileUser) =>
  inServerOrder(a.name ?? '', b.name ?? '') ||
  inServerOrder(a.email ?? '', b.email ?? '');

function AdminPicker({
  inputRef,
  takenEmails,
  onPick,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  takenEmails: Set<string>;
  onPick: (option: PickerOption) => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tDecisions = useTranslations('decisions');
  const tShared = useTranslations();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query.trim(), 200);
  const isSearching = debouncedQuery.length >= 2;

  const {
    data: searchResults,
    isFetching,
    isError,
  } = trpc.profile.search.useQuery(
    { q: debouncedQuery, types: [EntityType.INDIVIDUAL] },
    {
      enabled: isSearching,
      staleTime: 30_000,
      placeholderData: (previous) => previous,
    },
  );

  const options = useMemo<PickerOption[]>(() => {
    const people = (searchResults ?? [])
      .flatMap(({ results }) => results)
      .sort((a, b) => b.rank - a.rank)
      .flatMap((result) => {
        const email = result.user?.email;
        if (!email || takenEmails.has(email.toLowerCase())) {
          return [];
        }
        return [{ value: result.id, kind: 'person' as const, result, email }];
      });
    const canAddEmail =
      isValidEmail(debouncedQuery) &&
      !takenEmails.has(debouncedQuery.toLowerCase());

    return canAddEmail
      ? [
          { value: 'add-email', kind: 'email' as const, email: debouncedQuery },
          ...people,
        ]
      : people;
  }, [searchResults, takenEmails, debouncedQuery]);

  let emptyContent: ReactNode = tShared('No results');
  if (isFetching) {
    emptyContent = (
      <Spinner className="size-4" aria-label={tShared('loadingProgress')} />
    );
  } else if (isError) {
    emptyContent = t('adminSearchError');
  }

  return (
    <Combobox
      items={options}
      value={[]}
      multiple
      filter={null}
      onInputValueChange={(value) => setQuery(value)}
      onValueChange={(picked: PickerOption[]) => {
        const option = picked[picked.length - 1];
        if (option) {
          onPick(option);
          setQuery('');
        }
      }}
      itemToStringLabel={getOptionLabel}
      isItemEqualToValue={(a: PickerOption, b: PickerOption) =>
        a.value === b.value
      }
    >
      <label htmlFor={inputId} className="sr-only">
        {t('adminSearchLabel')}
      </label>
      <ComboboxChips className="w-full">
        <LuSearch
          className="size-4 shrink-0 self-center text-muted-foreground"
          aria-hidden
        />
        <ComboboxChipsInput
          ref={inputRef}
          id={inputId}
          placeholder={t('adminSearchPlaceholder')}
        />
      </ComboboxChips>
      {isSearching ? (
        <ComboboxContent>
          <ComboboxEmpty>{emptyContent}</ComboboxEmpty>
          <ComboboxList>
            {(option: PickerOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.kind === 'email' ? (
                  <span className="text-sm">
                    {tDecisions('inviteEmailAction', { email: option.email })}
                  </span>
                ) : (
                  <ProfileItem
                    avatar={
                      <ProfileAvatar
                        profile={option.result}
                        withLink={false}
                        alt=""
                        className="size-8 shrink-0"
                      />
                    }
                    title={option.result.name}
                    description={option.email}
                  />
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      ) : null}
    </Combobox>
  );
}

function AdminRow({
  admin,
  profileId,
  roleId,
  adminCount,
  onRemoved,
}: {
  admin: ProfileUser;
  profileId: string;
  roleId: string;
  adminCount: number;
  onRemoved: () => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const user = useMaybeUser();
  const name = admin.profile?.name || admin.name || admin.email || '';
  const isSelf =
    (admin.profile?.id !== undefined && admin.profile.id === user?.profileId) ||
    (hasEmail(admin) && admin.email === user?.email);

  const demote = trpc.profile.updateUserRoles.useMutation();
  const removeUser = trpc.profile.removeUser.useMutation();
  const { isRemoving, remove } = usePendingRemoval({
    profileId,
    failureLog: 'Process admin removal failed',
    successMessage: t.rich('adminRemoved', { name, bdi }),
    onRemoved,
    run: () => {
      const action = getAdminRemoveAction({ admin, roleId });
      return action.kind === 'demote'
        ? demote.mutateAsync({
            profileUserId: action.profileUserId,
            roleIds: action.roleIds,
          })
        : removeUser.mutateAsync({ profileUserId: action.profileUserId });
    },
  });

  let description = admin.profile?.name
    ? (admin.email ?? undefined)
    : undefined;
  if (isRemoving) {
    description = t('removingAdminLabel');
  }

  let action: ReactNode = null;
  if (isSelf) {
    action = <Badge variant="secondary">{t('youBadge')}</Badge>;
  } else if (canRemoveAdmin({ admin, adminCount })) {
    action = (
      <RemoveMenu
        label={t('manageAdminLabel', { name })}
        disabled={isRemoving}
        onRemove={remove}
      />
    );
  }

  return (
    <AdminListRow
      name={name}
      profile={{ ...admin.profile, name, email: admin.email }}
      description={description}
      isBusy={isRemoving}
      action={action}
    />
  );
}

function PendingMemberRow({ member }: { member: ProfileUser }) {
  const t = useTranslations('decisions.processAdmin');
  const name = member.profile?.name || member.name || member.email || '';

  return (
    <AdminListRow
      name={name}
      profile={{ ...member.profile, name, email: member.email }}
      description={
        member.profile?.name ? (member.email ?? undefined) : undefined
      }
      isBusy
      status={t('addingAdminLabel')}
    />
  );
}

function PendingInviteRow({ pending }: { pending: PendingInvite }) {
  const t = useTranslations('decisions.processAdmin');
  const tDecisions = useTranslations('decisions');
  const { option, movedInvite } = pending;
  const invitee =
    movedInvite?.inviteeProfile ??
    (option.kind === 'person' ? option.result : undefined);

  return (
    <AdminListRow
      name={invitee?.name || option.email}
      profile={invitee ?? { email: option.email }}
      description={tDecisions('invitedStatus')}
      isBusy
      status={t('addingAdminLabel')}
    />
  );
}

function InviteRow({
  invite,
  profileId,
  onRemoved,
}: {
  invite: ProfileInvite;
  profileId: string;
  onRemoved: () => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tDecisions = useTranslations('decisions');
  const name = invite.inviteeProfile?.name || invite.email;

  const deleteInvite = trpc.profile.deleteProfileInvite.useMutation();
  const { isRemoving, remove } = usePendingRemoval({
    profileId,
    failureLog: 'Process admin invite removal failed',
    successMessage: t.rich('adminInviteWithdrawn', { name, bdi }),
    onRemoved,
    run: () => deleteInvite.mutateAsync({ inviteId: invite.id }),
  });

  return (
    <AdminListRow
      name={name}
      profile={invite.inviteeProfile ?? { email: invite.email }}
      description={
        isRemoving ? t('removingAdminLabel') : tDecisions('invitedStatus')
      }
      isBusy={isRemoving}
      action={
        <RemoveMenu
          label={t('manageAdminLabel', { name })}
          disabled={isRemoving}
          onRemove={remove}
        />
      }
    />
  );
}

function AdminListRow({
  name,
  profile,
  description,
  isBusy,
  action,
  status,
}: {
  name: string;
  profile: ComponentProps<typeof ProfileAvatar>['profile'];
  description?: string;
  isBusy: boolean;
  action?: ReactNode;
  status?: string;
}) {
  return (
    <li
      aria-busy={isBusy}
      className="flex items-center justify-between gap-3 py-3"
    >
      <div className={cn('min-w-0', isBusy && 'opacity-50')}>
        <ProfileItem
          avatar={
            <ProfileAvatar
              profile={profile}
              withLink={false}
              alt=""
              className="size-8 shrink-0"
            />
          }
          title={name}
          description={description}
        />
      </div>
      {action}
      {status ? <span className="sr-only">{status}</span> : null}
    </li>
  );
}

/** Runs a removal and keeps its row pending until the lists no longer carry it. */
function usePendingRemoval({
  profileId,
  failureLog,
  successMessage,
  onRemoved,
  run,
}: {
  profileId: string;
  failureLog: string;
  successMessage: ReactNode;
  onRemoved: () => void;
  run: () => Promise<unknown>;
}) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();
  const [isRemoving, setIsRemoving] = useState(false);

  const remove = async () => {
    setIsRemoving(true);
    try {
      await run();
      await Promise.all([
        utils.profile.listUsers.invalidate({ profileId }),
        utils.profile.listProfileInvites.invalidate({ profileId }),
      ]);
      toast.success(successMessage);
      onRemoved();
    } catch (error) {
      logger.error(failureLog, { error });
      toast.error(t('removeAdminError'));
    } finally {
      setIsRemoving(false);
    }
  };

  return { isRemoving, remove: () => void remove() };
}

function RemoveMenu({
  label,
  disabled,
  onRemove,
}: {
  label: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  const tShared = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={disabled}
          />
        }
      >
        <LuEllipsisVertical className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end">
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <LuTrash2 className="size-4" aria-hidden />
          {tShared('Remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
