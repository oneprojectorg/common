'use client';

import { getPublicUrl } from '@/utils';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useMaybeUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import type { ProfileInvite, ProfileSearchResult } from '@op/api/encoders';
import { PAGE_LIMIT, type ProfileUser, hasEmail } from '@op/common/client';
import { useDebounce } from '@op/hooks';
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

interface ProcessAdminsPanelProps {
  /** The process profile the admin role belongs to. */
  profileId: string;
}

type PickerOption =
  | {
      value: string;
      kind: 'person';
      result: ProfileSearchResult;
      email: string;
    }
  | { value: string; kind: 'email'; email: string };

/** The admins of a process: a search-or-email picker that invites on pick, over the list of who has the admin role. */
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

export function ProcessAdminsPanelSkeleton() {
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
  const adminRole =
    roles.items.find((role) => role.permissions?.admin) ??
    roles.items.find((role) => role.name === 'Admin');

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
  const [users] = trpc.profile.listUsers.useSuspenseQuery({
    profileId,
    roleId,
    limit: PAGE_LIMIT.max,
  });
  const [allInvites] = trpc.profile.listProfileInvites.useSuspenseQuery({
    profileId,
  });
  const admins = users.items;
  const invites = allInvites.items.filter(
    (invite) => invite.accessRoleId === roleId,
  );

  const takenEmails = useMemo(
    () =>
      new Set([
        ...admins.filter(hasEmail).map((admin) => admin.email.toLowerCase()),
        ...invites.map((invite) => invite.email.toLowerCase()),
      ]),
    [admins, invites],
  );

  const refresh = async () => {
    await Promise.all([
      utils.profile.listUsers.invalidate({ profileId }),
      utils.profile.listProfileInvites.invalidate({ profileId }),
    ]);
  };

  const invite = trpc.profile.invite.useMutation({
    onSuccess: async (data, variables) => {
      await refresh();
      const email = variables.invitations[0]?.email ?? '';
      if (data.details.failed.length > 0) {
        toast.error(t('inviteFailed', { email }), {
          description: data.details.failed[0]?.reason,
        });
      } else {
        toast.success(t('inviteSent', { email }));
      }
    },
    onError: (error, variables) => {
      toast.error(
        t('inviteFailed', { email: variables.invitations[0]?.email ?? '' }),
        { description: error.message },
      );
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <AdminPicker
        takenEmails={takenEmails}
        disabled={invite.isPending}
        onPick={(email) =>
          invite.mutate({ profileId, invitations: [{ email, roleId }] })
        }
      />
      <ul className="flex flex-col divide-y border-t" aria-live="polite">
        {admins.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            isOnlyAdmin={admins.length <= 1}
            onRemoved={refresh}
          />
        ))}
        {invites.map((pendingInvite) => (
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
  onPick: (email: string) => void;
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
          onPick(option.email);
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
                    {tDecisions('inviteEmailAction', { email: option.email })}
                  </span>
                ) : (
                  <ProfileItem
                    avatar={
                      <Avatar className="size-8 shrink-0">
                        {option.result.avatarImage?.name ? (
                          <AvatarImage
                            src={
                              getPublicUrl(option.result.avatarImage.name) ?? ''
                            }
                            alt=""
                          />
                        ) : null}
                        <AvatarFallback>
                          {option.result.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
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
  isOnlyAdmin,
  onRemoved,
}: {
  admin: ProfileUser;
  isOnlyAdmin: boolean;
  onRemoved: () => Promise<void>;
}) {
  const t = useTranslations('decisions.processAdmin');
  const user = useMaybeUser();
  const name = admin.profile?.name || admin.name || admin.email || '';
  const isSelf =
    (admin.profile?.id !== undefined &&
      admin.profile?.id === user?.profileId) ||
    (hasEmail(admin) && admin.email === user?.email);
  // The owner and the last admin keep their access; the server refuses both anyway.
  const canRemove = !isSelf && !admin.isOwner && !isOnlyAdmin;

  const removeUser = trpc.profile.removeUser.useMutation({
    onSuccess: onRemoved,
    onError: (error) => {
      toast.error(t('removeAdminError'), { description: error.message });
    },
  });

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
      ) : canRemove ? (
        <RemoveMenu
          label={t('manageAdminLabel', { name })}
          disabled={removeUser.isPending}
          onRemove={() => removeUser.mutate({ profileUserId: admin.id })}
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
      toast.error(t('removeAdminError'), { description: error.message });
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
        <AvatarImage src={getPublicUrl(imageName) ?? ''} alt="" />
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
