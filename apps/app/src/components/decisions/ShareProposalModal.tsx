'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { hasEmail } from '@op/common/client';
import { useDebounce } from '@op/hooks';
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from '@op/sense/Empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from '@op/sense/Item';
import { ProfileAvatar as SenseProfileAvatar } from '@op/sense/ProfileAvatar';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Spinner } from '@op/sense/Spinner';
import { toast } from '@op/sense/Toast';
import {
  type ReactNode,
  Suspense,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from 'react';
import { LuLink, LuSearch, LuUsers, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import ErrorBoundary from '../ErrorBoundary';
import { ProfileAvatar } from '../ProfileAvatar';
import { isValidEmail, parseEmailPaste } from './emailUtils';

interface PendingInvite {
  id: string;
  profileId?: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export function ShareProposalModal({
  proposalProfileId,
  isOpen,
  onOpenChange,
}: {
  proposalProfileId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const t = useTranslations();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('Share Proposal')}</DialogTitle>
        </DialogHeader>

        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-8">
                <Spinner className="size-6" />
              </div>
            }
          >
            <ShareProposalModalContent
              proposalProfileId={proposalProfileId}
              onOpenChange={onOpenChange}
            />
          </Suspense>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

function ShareProposalModalContent({
  proposalProfileId,
  onOpenChange,
}: {
  proposalProfileId: string;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  const [, startTransition] = useTransition();

  const [usersData] = trpc.profile.listUsers.useSuspenseQuery({
    profileId: proposalProfileId,
  });
  const [serverInvites] = trpc.profile.listProfileInvites.useSuspenseQuery({
    profileId: proposalProfileId,
  });

  const [optimisticUsers, dispatchRemoveUser] = useOptimistic(
    usersData.items,
    (state, profileUserId: string) =>
      state.filter((u) => u.id !== profileUserId),
  );

  const [optimisticInvites, dispatchRemoveInvite] = useOptimistic(
    serverInvites,
    (state, inviteId: string) => state.filter((i) => i.id !== inviteId),
  );

  const [rolesData] = trpc.profile.listRoles.useSuspenseQuery({});
  const memberRole = useMemo(() => {
    const roles = rolesData.items ?? [];
    return roles.find((r) => r.name === 'Member');
  }, [rolesData]);

  // Search for users to invite
  const { data: searchResults, isFetching: isSearching } =
    trpc.profile.search.useQuery(
      { q: debouncedQuery, types: [EntityType.INDIVIDUAL] },
      {
        enabled: debouncedQuery.length >= 2,
        placeholderData: (prev) => prev,
      },
    );

  // Results come pre-sorted by rank from the API
  const flattenedResults = useMemo(
    () => searchResults?.flatMap(({ results }) => results) ?? [],
    [searchResults],
  );

  // Filter out already selected, existing users, and sent invites
  const filteredResults = useMemo(() => {
    const existingIds = new Set(optimisticUsers.map((u) => u.profileId));
    const pendingIds = new Set(
      pendingInvites.map((i) => i.profileId).filter(Boolean),
    );
    const takenEmails = new Set([
      ...pendingInvites.map((i) => i.email.toLowerCase()),
      ...optimisticUsers.filter(hasEmail).map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);

    return flattenedResults.filter(
      (result) =>
        !existingIds.has(result.id) &&
        !pendingIds.has(result.id) &&
        (!result.user?.email ||
          !takenEmails.has(result.user.email.toLowerCase())),
    );
  }, [flattenedResults, optimisticUsers, pendingInvites, optimisticInvites]);

  // Check if query is a valid email not already added
  const canAddEmail = useMemo(() => {
    if (!isValidEmail(debouncedQuery)) {
      return false;
    }
    const lowerQuery = debouncedQuery.toLowerCase();
    const takenEmails = new Set([
      ...pendingInvites.map((i) => i.email.toLowerCase()),
      ...optimisticUsers.filter(hasEmail).map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);
    return !takenEmails.has(lowerQuery);
  }, [debouncedQuery, pendingInvites, optimisticUsers, optimisticInvites]);

  // Combobox options: the server-filtered people plus a synthetic "invite this
  // email" row. The server already filters, so base-ui's local filter is off.
  const pickerOptions = useMemo(
    () => [
      ...(canAddEmail
        ? [
            {
              value: 'add-email',
              label: debouncedQuery,
              addEmail: true as const,
              result: undefined,
            },
          ]
        : []),
      ...filteredResults.map((result) => ({
        value: result.id,
        label: result.name,
        addEmail: false as const,
        result,
      })),
    ],
    [canAddEmail, debouncedQuery, filteredResults],
  );
  type PickerOption = (typeof pickerOptions)[number];

  const inviteMutation = trpc.profile.invite.useMutation();
  const removeUserMutation = trpc.profile.removeUser.useMutation();
  const deleteInviteMutation = trpc.profile.deleteProfileInvite.useMutation();

  const handleSelectItem = (result: (typeof flattenedResults)[0]) => {
    const userEmail = result.user?.email;
    if (!userEmail) {
      return;
    }
    setPendingInvites((prev) => [
      ...prev,
      {
        id: result.id,
        profileId: result.id,
        name: result.name,
        email: userEmail,
        avatarUrl: result.avatarImage?.name
          ? getPublicUrl(result.avatarImage.name)
          : undefined,
      },
    ]);
    setSearchQuery('');
  };

  const handleAddEmail = (email: string) => {
    setPendingInvites((prev) => [
      ...prev,
      {
        id: `email-${email}`,
        name: email,
        email,
      },
    ]);
    setSearchQuery('');
  };

  // The combobox value is never persisted — each pick runs an action and the
  // control resets to empty, so `value={[]}` stays authoritative.
  const handlePickOption = (selected: PickerOption[]) => {
    const added = selected[selected.length - 1];
    if (!added) {
      return;
    }
    if (added.addEmail) {
      handleAddEmail(debouncedQuery);
    } else {
      handleSelectItem(added.result);
    }
  };

  const handleRemovePending = (id: string) => {
    setPendingInvites((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveExistingUser = (profileUserId: string) => {
    startTransition(async () => {
      dispatchRemoveUser(profileUserId);
      try {
        await removeUserMutation.mutateAsync({ profileUserId });
      } catch {
        toast.error(t('Failed to remove user'));
      }
      await utils.profile.listUsers.invalidate({
        profileId: proposalProfileId,
      });
    });
  };

  const handleDeleteInvite = (inviteId: string) => {
    startTransition(async () => {
      dispatchRemoveInvite(inviteId);
      try {
        await deleteInviteMutation.mutateAsync({ inviteId });
      } catch {
        toast.error(t('Failed to cancel invite'));
      }
      await utils.profile.listProfileInvites.invalidate({
        profileId: proposalProfileId,
      });
    });
  };

  const handleCopyLink = async () => {
    try {
      // Build the invite link from the current URL up to /proposal/{profileId}
      const path = window.location.pathname;
      const proposalIndex = path.indexOf(`/proposal/${proposalProfileId}`);
      const basePath =
        proposalIndex !== -1
          ? path.slice(
              0,
              proposalIndex + `/proposal/${proposalProfileId}`.length,
            )
          : path;
      const inviteUrl = `${window.location.origin}${basePath}/invite`;
      await navigator.clipboard.writeText(inviteUrl);
      toast.success(t('Link copied to clipboard'));
    } catch {
      toast.error(t('Failed to copy link'));
    }
  };

  const handleDone = async () => {
    if (pendingInvites.length === 0) {
      handleClose();
      return;
    }

    if (!memberRole) {
      toast.error(t('Failed to send invite'));
      return;
    }

    try {
      await inviteMutation.mutateAsync({
        invitations: pendingInvites.map((item) => ({
          email: item.email,
          roleId: memberRole.id,
        })),
        profileId: proposalProfileId,
      });

      toast.success(t('Invite sent successfully'));
      setPendingInvites([]);
      setSearchQuery('');
      onOpenChange(false);
      utils.profile.listUsers.invalidate({ profileId: proposalProfileId });
      utils.profile.listProfileInvites.invalidate({
        profileId: proposalProfileId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to send invite');
      toast.error(message);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) {
      return;
    }

    const takenEmails = new Set([
      ...pendingInvites.map((i) => i.email.toLowerCase()),
      ...optimisticUsers.filter(hasEmail).map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);
    const emails = parseEmailPaste(pastedText, takenEmails);
    if (!emails) {
      return;
    }

    e.preventDefault();

    if (emails.length > 0) {
      const newItems = emails.map((email) => ({
        id: `email-${email}`,
        name: email,
        email,
      }));
      setPendingInvites((prev) => [...prev, ...newItems]);
    }

    setSearchQuery('');
  };

  const handleClose = () => {
    setPendingInvites([]);
    setSearchQuery('');
    onOpenChange(false);
  };

  const hasNoPeople =
    optimisticUsers.length === 0 &&
    pendingInvites.length === 0 &&
    optimisticInvites.length === 0;

  return (
    <>
      <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-4">
        {/* People search — base-ui owns positioning, focus and the
            listbox/option roles, so there's no portal or measured dropdown. */}
        <Combobox
          items={pickerOptions}
          value={[]}
          onValueChange={handlePickOption}
          filter={null}
          onInputValueChange={setSearchQuery}
          itemToStringLabel={(option: PickerOption) => option.label}
          isItemEqualToValue={(a: PickerOption, b: PickerOption) =>
            a.value === b.value
          }
          multiple
        >
          <ComboboxChips className="w-full" onPaste={handlePaste}>
            <LuSearch className="size-4 shrink-0 self-center text-muted-foreground" />
            <ComboboxChipsInput
              placeholder={t('Invite collaborators by name or email')}
            />
          </ComboboxChips>
          {debouncedQuery.length >= 2 && (
            <ComboboxContent>
              <ComboboxEmpty>
                {isSearching ? <Spinner className="size-4" /> : t('No results')}
              </ComboboxEmpty>
              <ComboboxList>
                {(option: PickerOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    {option.addEmail ? (
                      <span className="text-sm">
                        {t('Invite {email}', { email: debouncedQuery })}
                      </span>
                    ) : (
                      <ProfileItem
                        avatar={
                          // `withLink={false}`: an anchor inside a combobox
                          // option would be nested interactive content.
                          <ProfileAvatar
                            profile={option.result}
                            withLink={false}
                            className="size-8 shrink-0"
                          />
                        }
                        title={option.result.name}
                        description={option.result.user?.email || undefined}
                      />
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          )}
        </Combobox>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-foreground">
            {t('People with access')}
          </span>

          <div className="flex flex-col gap-2">
            {pendingInvites.map((item) => (
              <PersonRow
                key={item.id}
                name={item.name}
                avatarUrl={item.avatarUrl}
                subtitle={
                  item.name !== item.email ? (
                    <div className="truncate text-sm text-muted-foreground">
                      {item.email}
                    </div>
                  ) : undefined
                }
                onRemove={() => handleRemovePending(item.id)}
                removeLabel={t('Remove {name}', { name: item.name })}
              />
            ))}

            {optimisticInvites.map((invite) => {
              const displayName = invite.inviteeProfile?.name ?? invite.email;
              const avatarUrl = invite.inviteeProfile?.avatarImage?.name
                ? getPublicUrl(invite.inviteeProfile.avatarImage.name)
                : undefined;

              return (
                <PersonRow
                  key={invite.id}
                  name={displayName}
                  avatarUrl={avatarUrl}
                  subtitle={
                    <div className="truncate text-sm text-muted-foreground">
                      {invite.inviteeProfile?.name && (
                        <>
                          {invite.email} <Bullet />{' '}
                        </>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {t('Invited')}
                      </span>
                    </div>
                  }
                  onRemove={() => handleDeleteInvite(invite.id)}
                  removeLabel={t('Remove {name}', { name: displayName })}
                />
              );
            })}

            {hasNoPeople ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LuUsers />
                  </EmptyMedia>
                  <EmptyDescription>
                    {t('No one has been invited yet')}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              optimisticUsers.map((user) => {
                const displayName = user.name ?? user.email ?? '';

                return (
                  <PersonRow
                    key={user.id}
                    name={displayName}
                    avatarUrl={
                      user.profile?.avatarImage?.name
                        ? getPublicUrl(user.profile.avatarImage.name)
                        : undefined
                    }
                    subtitle={
                      user.name ? (
                        <div className="truncate text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      ) : undefined
                    }
                    // The owner can't be removed from their own proposal.
                    onRemove={
                      user.isOwner
                        ? undefined
                        : () => handleRemoveExistingUser(user.id)
                    }
                    removeLabel={t('Remove {name}', { name: displayName })}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="flex-row items-center justify-between sm:justify-between">
        <Button variant="outline" onClick={handleCopyLink}>
          <LuLink className="size-4" />
          {t('Copy link')}
        </Button>
        <Button onClick={handleDone} loading={inviteMutation.isPending}>
          {t('Done')}
        </Button>
      </DialogFooter>
    </>
  );
}

function PersonRow({
  name,
  avatarUrl,
  subtitle,
  onRemove,
  removeLabel,
}: {
  name: string;
  avatarUrl?: string;
  subtitle?: ReactNode;
  onRemove?: () => void;
  removeLabel: string;
}) {
  return (
    <Item variant="outline" className="flex-nowrap px-3 py-2 sm:p-3">
      <ItemMedia>
        {/* The sense primitive, not the app wrapper: callers hand this row an
            already-resolved `avatarUrl`, not a profile. Passing `name` through
            is what earns the seeded initial + gradient fallback. */}
        <SenseProfileAvatar
          name={name}
          src={avatarUrl}
          alt={name}
          className="size-6 shrink-0 sm:size-10"
        />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0">
        <ItemTitle>{name}</ItemTitle>
        {subtitle}
      </ItemContent>
      {onRemove && (
        <ItemActions className="shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={removeLabel}
          >
            <LuX className="size-4" />
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}
