'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useMaybeUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import type { ProfileInvite, ProfileSearchResult } from '@op/api/encoders';
import { PAGE_LIMIT, type ProfileUser, hasEmail } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { logger } from '@op/logging/client';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
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
import { Suspense, useId, useMemo, useState } from 'react';
import { LuEllipsisVertical, LuSearch, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { isValidEmail } from '../emailUtils';
import {
  type AdminPickerOption,
  canRemoveAdmin,
  findAdminRole,
  getAdminPickAction,
  getAdminRemoveAction,
} from './processAdminActions';

interface ProcessAdminsPanelProps {
  /** The process profile the admin role belongs to. */
  profileId: string;
}

type PickerOption = AdminPickerOption<ProfileSearchResult>;

/** The admins of a process: a search-or-email picker that grants the role on pick, over the list of who holds it. */
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
      <p role="alert" className="text-sm text-muted-foreground">
        {t('adminRoleMissing')}
      </p>
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
  // Every member, not only the admins: a participant picked in the search is
  // promoted, not invited again.
  const [users] = trpc.profile.listUsers.useSuspenseQuery({
    profileId,
    limit: PAGE_LIMIT.max,
  });
  const [allInvites] = trpc.profile.listProfileInvites.useSuspenseQuery({
    profileId,
  });
  const members = users.items;
  const admins = useMemo(
    () =>
      members.filter((member) =>
        member.roles.some((role) => role.id === roleId),
      ),
    [members, roleId],
  );
  const adminInvites = useMemo(
    () => allInvites.items.filter((invite) => invite.accessRoleId === roleId),
    [allInvites, roleId],
  );
  const takenEmails = useMemo(
    () =>
      new Set([
        ...admins.filter(hasEmail).map((admin) => admin.email.toLowerCase()),
        ...adminInvites.map((invite) => invite.email.toLowerCase()),
      ]),
    [admins, adminInvites],
  );

  // The member mutations broadcast the profileMembers channel; the
  // invalidation covers the gap before the client is subscribed.
  const refresh = async () => {
    await Promise.all([
      utils.profile.listUsers.invalidate({ profileId }),
      utils.profile.listProfileInvites.invalidate({ profileId }),
    ]);
  };
  const reportFailure = (email: string, error: unknown) => {
    logger.error('Process admin grant failed', { error });
    toast.error(t('inviteFailed', { email }));
  };

  const invite = trpc.profile.invite.useMutation({
    onSuccess: async (data, variables) => {
      await refresh();
      const email = variables.invitations[0]?.email ?? '';
      if (data.details.failed.length > 0) {
        toast.error(t('inviteFailed', { email }));
      } else {
        toast.success(t('inviteSent', { email }));
      }
    },
    onError: (error, variables) =>
      reportFailure(variables.invitations[0]?.email ?? '', error),
  });
  const promote = trpc.profile.updateUserRoles.useMutation({
    onSuccess: refresh,
  });
  const moveInvite = trpc.profile.updateProfileInvite.useMutation({
    onSuccess: refresh,
  });
  const isGranting =
    invite.isPending || promote.isPending || moveInvite.isPending;

  const handlePick = (option: PickerOption) => {
    const action = getAdminPickAction({
      option,
      members,
      invites: allInvites.items,
      roleId,
    });
    switch (action.kind) {
      case 'promote': {
        const name =
          option.kind === 'person' ? option.result.name : option.email;
        promote.mutate(
          { profileUserId: action.profileUserId, roleIds: action.roleIds },
          {
            onSuccess: () => toast.success(t('adminAdded', { name })),
            onError: (error) => reportFailure(option.email, error),
          },
        );
        return;
      }
      case 'moveInvite':
        moveInvite.mutate(
          { inviteId: action.inviteId, accessRoleId: roleId },
          {
            onSuccess: () =>
              toast.success(t('inviteSent', { email: option.email })),
            onError: (error) => reportFailure(option.email, error),
          },
        );
        return;
      case 'invite':
        invite.mutate({
          profileId,
          invitations: [{ email: action.email, roleId }],
        });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <AdminPicker
        takenEmails={takenEmails}
        disabled={isGranting}
        onPick={handlePick}
      />
      <ul className="flex flex-col divide-y border-t">
        {admins.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            roleId={roleId}
            adminCount={admins.length}
            onRemoved={refresh}
          />
        ))}
        {adminInvites.map((pendingInvite) => (
          <InviteRow
            key={pendingInvite.id}
            invite={pendingInvite}
            onRemoved={refresh}
          />
        ))}
      </ul>
    </div>
  );
}

function AdminPicker({
  takenEmails,
  disabled,
  onPick,
}: {
  takenEmails: Set<string>;
  disabled: boolean;
  onPick: (option: PickerOption) => void;
}) {
  const t = useTranslations('decisions.processAdmin');
  const tDecisions = useTranslations('decisions');
  const tShared = useTranslations();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query.trim(), 200);
  const isSearching = debouncedQuery.length >= 2;

  const { data: searchResults, isFetching } = trpc.profile.search.useQuery(
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

  return (
    <Combobox
      items={options}
      value={[]}
      multiple
      disabled={disabled}
      filter={null}
      onInputValueChange={(value) => setQuery(value)}
      onValueChange={(picked: PickerOption[]) => {
        const option = picked[picked.length - 1];
        if (option) {
          onPick(option);
          setQuery('');
        }
      }}
      itemToStringLabel={(option: PickerOption) =>
        option.kind === 'person' ? option.result.name : option.email
      }
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
          id={inputId}
          placeholder={t('adminSearchPlaceholder')}
        />
      </ComboboxChips>
      {isSearching ? (
        <ComboboxContent>
          <ComboboxEmpty>
            {isFetching ? (
              <Spinner className="size-4" />
            ) : (
              tShared('No results')
            )}
          </ComboboxEmpty>
          <ComboboxList>
            {(option: PickerOption) => (
              <ComboboxItem key={option.value} value={option}>
                {option.kind === 'email' ? (
                  <span className="text-sm">
                    {tDecisions.rich('inviteEmailAction', {
                      email: () => <bdi dir="ltr">{option.email}</bdi>,
                    })}
                  </span>
                ) : (
                  <ProfileItem
                    avatar={
                      <AdminAvatar
                        name={option.result.name}
                        imageName={option.result.avatarImage?.name}
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
  roleId,
  adminCount,
  onRemoved,
}: {
  admin: ProfileUser;
  roleId: string;
  adminCount: number;
  onRemoved: () => Promise<void>;
}) {
  const t = useTranslations('decisions.processAdmin');
  const user = useMaybeUser();
  const name = admin.profile?.name || admin.name || admin.email || '';
  const isSelf =
    (admin.profile?.id !== undefined && admin.profile.id === user?.profileId) ||
    (hasEmail(admin) && admin.email === user?.email);

  const reportFailure = (error: unknown) => {
    logger.error('Process admin removal failed', { error });
    toast.error(t('removeAdminError'));
  };
  const demote = trpc.profile.updateUserRoles.useMutation({
    onSuccess: onRemoved,
    onError: reportFailure,
  });
  const removeUser = trpc.profile.removeUser.useMutation({
    onSuccess: onRemoved,
    onError: reportFailure,
  });

  const remove = () => {
    const action = getAdminRemoveAction(admin, roleId);
    if (action.kind === 'demote') {
      demote.mutate({
        profileUserId: action.profileUserId,
        roleIds: action.roleIds,
      });
    } else {
      removeUser.mutate({ profileUserId: action.profileUserId });
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <ProfileItem
        avatar={
          <AdminAvatar
            name={name}
            imageName={admin.profile?.avatarImage?.name}
          />
        }
        title={name}
        description={
          admin.profile?.name ? (admin.email ?? undefined) : undefined
        }
      />
      {isSelf ? (
        <Badge variant="secondary">{t('youBadge')}</Badge>
      ) : canRemoveAdmin({ admin, isSelf, adminCount }) ? (
        <RemoveMenu
          label={t('manageAdminLabel', { name })}
          disabled={demote.isPending || removeUser.isPending}
          onRemove={remove}
        />
      ) : null}
    </li>
  );
}

function InviteRow({
  invite,
  onRemoved,
}: {
  invite: ProfileInvite;
  onRemoved: () => Promise<void>;
}) {
  const t = useTranslations('decisions.processAdmin');
  const name = invite.inviteeProfile?.name || invite.email;

  const deleteInvite = trpc.profile.deleteProfileInvite.useMutation({
    onSuccess: onRemoved,
    onError: (error) => {
      logger.error('Process admin invite removal failed', { error });
      toast.error(t('removeAdminError'));
    },
  });

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <ProfileItem
        avatar={
          <AdminAvatar
            name={name}
            imageName={invite.inviteeProfile?.avatarImage?.name}
          />
        }
        title={name}
        description={t('invitedLabel')}
      />
      <RemoveMenu
        label={t('manageAdminLabel', { name })}
        disabled={deleteInvite.isPending}
        onRemove={() => deleteInvite.mutate({ inviteId: invite.id })}
      />
    </li>
  );
}

function AdminAvatar({
  name,
  imageName,
}: {
  name: string;
  imageName?: string | null;
}) {
  return (
    <Avatar className="size-8 shrink-0">
      {imageName ? (
        <AvatarImage src={getPublicUrl(imageName) ?? undefined} alt="" />
      ) : null}
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
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
