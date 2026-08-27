'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { hasEmail } from '@op/common/client';
import { useDebounce, useInfiniteScroll } from '@op/hooks';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { Avatar, AvatarFallback, AvatarImage } from '@op/sense/Avatar';
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
  EmptyHeader,
  EmptyMedia,
  EmptyDescription,
} from '@op/sense/Empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from '@op/sense/Item';
import { ProfileItem } from '@op/sense/ProfileItem';
import { Skeleton } from '@op/sense/Skeleton';
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
import { LuLeaf, LuSearch, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import ErrorBoundary from '../ErrorBoundary';
import { RoleSelector, RoleSelectorSkeleton } from './RoleSelector';
import { isValidEmail, parseEmailPaste } from './emailUtils';

interface SelectedItem {
  id: string;
  profileId?: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

// Map from roleId to array of selected items for that role
type SelectedItemsByRole = Record<string, SelectedItem[]>;

export const ProfileInviteModal = ({
  profileId,
  isDraft,
  isOpen,
  onOpenChange,
}: {
  profileId: string;
  isDraft: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t('Invite participants to your decision-making process')}
          </DialogTitle>
        </DialogHeader>

        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="space-y-6 px-6 py-4">
                <RoleSelectorSkeleton />
                <div className="flex items-center justify-center p-8">
                  <Spinner className="size-6" />
                </div>
              </div>
            }
          >
            <ProfileInviteModalContent
              profileId={profileId}
              isDraft={isDraft}
              onOpenChange={onOpenChange}
            />
          </Suspense>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
};

function ProfileInviteModalContent({
  profileId,
  isDraft,
  onOpenChange,
}: {
  profileId: string;
  isDraft: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [selectedItemsByRole, setSelectedItemsByRole] =
    useState<SelectedItemsByRole>({});
  const [requestedRoleId, setRequestedRoleId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [isSubmitting, startSendTransition] = useTransition();
  const [, startOptimisticTransition] = useTransition();

  const rolesQueryInput = {
    profileId,
    zoneName: 'decisions',
    includeMemberCounts: true,
    limit: 100,
  };
  // Batched so the roles and pending-invites fetches fire together — two
  // separate useSuspenseQuery calls would suspend one after the other.
  const [[{ items: roles }, serverInvites]] = trpc.useSuspenseQueries((t) => [
    t.profile.listRoles(rolesQueryInput),
    t.profile.listProfileInvites({ profileId }),
  ]);
  const selectedRole =
    roles.find((role) => role.id === requestedRoleId) ?? roles[0];
  const selectedRoleId = selectedRole?.id ?? '';
  const selectedRoleName = selectedRole?.name ?? '';
  const showDraftBanner =
    isDraft && !!selectedRole && !selectedRole.permissions?.admin;

  // Members for the selected role, paginated server-side. React Query caches
  // per input key, so each role tab paginates independently and switching
  // tabs preserves already-loaded pages.
  const {
    data: usersData,
    isPending: isMembersPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.profile.listUsers.useInfiniteQuery(
    { profileId, roleId: selectedRoleId, limit: 25 },
    {
      getNextPageParam: (lastPage) => lastPage.next,
      enabled: !!selectedRoleId,
    },
  );

  const loadedMembers = useMemo(
    () => usersData?.pages.flatMap((page) => page.items) ?? [],
    [usersData],
  );

  const [optimisticInvites, dispatchRemoveInvite] = useOptimistic(
    serverInvites,
    (state, inviteId: string) => state.filter((i) => i.id !== inviteId),
  );

  const [optimisticUsers, dispatchRemoveUser] = useOptimistic(
    loadedMembers,
    (state, profileUserId: string) =>
      state.filter((u) => u.id !== profileUserId),
  );

  // Get items for current role
  const currentRoleItems = selectedItemsByRole[selectedRoleId] ?? [];

  // Roles staged items were added under can vanish mid-session (e.g. another
  // admin deletes a custom role while this modal is open); dropping their
  // entries here keeps a deleted role's leftovers out of counts and payloads.
  const validRoleIds = useMemo(
    () => new Set(roles.map((role) => role.id)),
    [roles],
  );

  // Get all selected items across all roles (for filtering duplicates)
  const allSelectedItems = useMemo(
    () =>
      Object.entries(selectedItemsByRole)
        .filter(([roleId]) => validRoleIds.has(roleId))
        .flatMap(([, items]) => items),
    [selectedItemsByRole, validRoleIds],
  );

  // Member emails cover the loaded pages for the selected role; the invite
  // service remains authoritative for members on other roles or pages.
  const takenEmails = useMemo(
    () =>
      new Set([
        ...allSelectedItems.map((item) => item.email.toLowerCase()),
        ...optimisticUsers
          .filter(hasEmail)
          .map((user) => user.email.toLowerCase()),
        ...optimisticInvites.map((invite) => invite.email.toLowerCase()),
      ]),
    [allSelectedItems, optimisticUsers, optimisticInvites],
  );

  // Filter server invites by current role
  const currentRoleInvites = useMemo(
    () => optimisticInvites.filter((i) => i.accessRoleId === selectedRoleId),
    [optimisticInvites, selectedRoleId],
  );

  // Members are already filtered to the selected role by the server query
  const currentRoleMembers = optimisticUsers;

  // State rather than a ref: the observer effect below needs a re-render once
  // the container attaches to pick it up as its root.
  const [memberListRoot, setMemberListRoot] = useState<HTMLDivElement | null>(
    null,
  );
  const { ref: scrollTriggerRef, shouldShowTrigger } = useInfiniteScroll(
    fetchNextPage,
    { hasNextPage, isFetchingNextPage, root: memberListRoot },
  );

  // Search for individuals
  const { data: searchResults, isFetching: isSearching } =
    trpc.profile.search.useQuery(
      { q: debouncedQuery, types: [EntityType.INDIVIDUAL] },
      {
        enabled: debouncedQuery.length >= 2,
        staleTime: 30_000,
        placeholderData: (prev) => prev,
      },
    );

  // Flatten and sort search results
  const flattenedResults = useMemo(() => {
    if (!searchResults) {
      return [];
    }
    return searchResults
      .flatMap(({ type, results }) =>
        results.map((result) => ({ ...result, entityType: type })),
      )
      .sort((a, b) => b.rank - a.rank);
  }, [searchResults]);

  // Filter out already selected, already invited, and loaded members.
  const filteredResults = useMemo(() => {
    const selectedIds = new Set(allSelectedItems.map((item) => item.profileId));
    return flattenedResults.filter(
      (result) =>
        !selectedIds.has(result.id) &&
        (!result.user?.email ||
          !takenEmails.has(result.user.email.toLowerCase())),
    );
  }, [flattenedResults, allSelectedItems, takenEmails]);

  // Check if query is a valid email that hasn't been selected yet.
  const canAddEmail = useMemo(() => {
    if (!isValidEmail(debouncedQuery)) {
      return false;
    }
    return !takenEmails.has(debouncedQuery.toLowerCase());
  }, [debouncedQuery, takenEmails]);

  // Combobox options: server-filtered people plus a synthetic "invite this
  // email" row. Server already filters, so base-ui's local filter is disabled.
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

  // Mutations
  const inviteMutation = trpc.profile.invite.useMutation();
  const deleteInviteMutation = trpc.profile.deleteProfileInvite.useMutation();
  const removeUserMutation = trpc.profile.removeUser.useMutation();

  // Calculate total people count across all roles (staged only)
  const totalPeople = allSelectedItems.length;

  // Merge authoritative member counts with staged items and pending invites so
  // each badge has one final count.
  const countsByRole = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      roles.map((role) => [role.id, role.memberCount ?? 0]),
    );
    for (const [roleId, items] of Object.entries(selectedItemsByRole)) {
      counts[roleId] = (counts[roleId] ?? 0) + items.length;
    }
    for (const invite of optimisticInvites) {
      counts[invite.accessRoleId] = (counts[invite.accessRoleId] ?? 0) + 1;
    }

    return counts;
  }, [roles, selectedItemsByRole, optimisticInvites]);

  const handleSelectItem = (result: (typeof flattenedResults)[0]) => {
    if (!result.user?.email || !selectedRoleId) {
      return;
    }
    const newItem: SelectedItem = {
      id: result.id,
      profileId: result.id,
      name: result.name,
      email: result.user.email,
      avatarUrl: result.avatarImage?.name
        ? getPublicUrl(result.avatarImage.name)
        : undefined,
    };

    setSelectedItemsByRole((prev) => ({
      ...prev,
      [selectedRoleId]: [...(prev[selectedRoleId] ?? []), newItem],
    }));
    setSearchQuery('');
  };

  const handleAddEmail = (email: string) => {
    if (!selectedRoleId) {
      return;
    }
    const newItem: SelectedItem = {
      id: `email-${email}`,
      name: email,
      email,
    };

    setSelectedItemsByRole((prev) => ({
      ...prev,
      [selectedRoleId]: [...(prev[selectedRoleId] ?? []), newItem],
    }));
    setSearchQuery('');
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItemsByRole((prev) => ({
      ...prev,
      [selectedRoleId]: (prev[selectedRoleId] ?? []).filter(
        (item) => item.id !== itemId,
      ),
    }));
  };

  const handleDeleteInvite = (inviteId: string) => {
    startOptimisticTransition(async () => {
      dispatchRemoveInvite(inviteId);
      try {
        await deleteInviteMutation.mutateAsync({ inviteId });
      } catch {
        toast.error(t('Failed to cancel invite'));
      }
      await utils.profile.listProfileInvites.invalidate({ profileId });
    });
  };

  const handleRemoveUser = ({
    id,
    roles: memberRoles,
  }: {
    id: string;
    roles: Array<{ id: string }>;
  }) => {
    startOptimisticTransition(async () => {
      dispatchRemoveUser(id);
      const removedRoleIds = new Set(memberRoles.map((role) => role.id));
      const updateMemberCounts = (delta: number) =>
        utils.profile.listRoles.setData(rolesQueryInput, (rolesData) =>
          rolesData
            ? {
                ...rolesData,
                items: rolesData.items.map((role) =>
                  removedRoleIds.has(role.id)
                    ? {
                        ...role,
                        memberCount: Math.max(
                          0,
                          (role.memberCount ?? 0) + delta,
                        ),
                      }
                    : role,
                ),
              }
            : rolesData,
        );
      updateMemberCounts(-1);
      try {
        await removeUserMutation.mutateAsync({ profileUserId: id });
        // The optimistic decrement above already holds the correct count;
        // listUsers still needs a refetch to drop the member from its pages.
        await utils.profile.listUsers.invalidate({ profileId });
      } catch {
        updateMemberCounts(1);
        toast.error(t('Failed to remove user'));
        // Partial input matching also invalidates the per-role infinite
        // queries; listRoles reconciles the rollback with server truth.
        await Promise.all([
          utils.profile.listUsers.invalidate({ profileId }),
          utils.profile.listRoles.invalidate({ profileId }),
        ]);
      }
    });
  };

  const handleSend = () => {
    startSendTransition(async () => {
      try {
        // Collect all invitations across all roles into a single array
        const invitations = Object.entries(selectedItemsByRole)
          .filter(
            ([roleId, items]) => validRoleIds.has(roleId) && items.length > 0,
          )
          .flatMap(([roleId, items]) =>
            items.map((item) => ({ email: item.email, roleId })),
          );

        if (invitations.length === 0) {
          return;
        }

        const result = await inviteMutation.mutateAsync({
          invitations,
          profileId,
        });

        if (result.details.failed.length > 0) {
          const successfulEmails = new Set(result.details.successful);
          setSelectedItemsByRole((selectedItems) =>
            Object.fromEntries(
              Object.entries(selectedItems).map(([roleId, items]) => [
                roleId,
                items.filter(
                  (item) => !successfulEmails.has(item.email.toLowerCase()),
                ),
              ]),
            ),
          );
          setSearchQuery('');
          // The server's reason strings aren't translated (same as the raw
          // error.message surfaced in the catch block below), but they're
          // the only way this toast explains why a retry would fail again.
          const failureDetail = result.details.failed
            .map((failure) => `${failure.email}: ${failure.reason}`)
            .join('; ');
          toast.error(`${t('Failed to send invite')}: ${failureDetail}`);

          if (result.details.successful.length > 0) {
            utils.profile.listUsers.invalidate({ profileId });
            utils.profile.listProfileInvites.invalidate({ profileId });
            utils.profile.listRoles.invalidate({ profileId });
          }
          return;
        }

        toast.success(t('Invite sent successfully'));
        setSelectedItemsByRole({});
        setSearchQuery('');
        onOpenChange(false);

        // Invalidate the lists and the per-role member counts (tab badges)
        utils.profile.listUsers.invalidate({ profileId });
        utils.profile.listProfileInvites.invalidate({ profileId });
        utils.profile.listRoles.invalidate({ profileId });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('Failed to send invite');
        toast.error(message);
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText || !selectedRoleId) {
      return;
    }

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
      setSelectedItemsByRole((prev) => ({
        ...prev,
        [selectedRoleId]: [...(prev[selectedRoleId] ?? []), ...newItems],
      }));
    }

    setSearchQuery('');
  };

  const hasNoItems =
    !isMembersPending &&
    currentRoleItems.length === 0 &&
    currentRoleInvites.length === 0 &&
    currentRoleMembers.length === 0;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
        {/* Role Tabs */}
        <RoleSelector
          roles={roles}
          selectedRoleId={selectedRoleId}
          onSelectionChange={setRequestedRoleId}
          countsByRole={countsByRole}
        />

        {showDraftBanner && (
          <Alert variant="warning">
            <AlertDescription>
              {t(
                'This process is still in draft. Participant invites will be sent when the process launches.',
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* People search — server-filtered picker; each pick adds to the
            role's list below and clears the input (value stays empty). */}
        <Combobox
          items={pickerOptions}
          value={[]}
          onValueChange={handlePickOption}
          filter={null}
          onInputValueChange={(value) => setSearchQuery(value)}
          itemToStringLabel={(option: PickerOption) => option.label}
          isItemEqualToValue={(a: PickerOption, b: PickerOption) =>
            a.value === b.value
          }
          multiple
        >
          <ComboboxChips className="w-full" onPaste={handlePaste}>
            <LuSearch className="size-4 shrink-0 self-center text-muted-foreground" />
            <ComboboxChipsInput placeholder={t('Search by name or email...')} />
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
                          <Avatar className="size-8 shrink-0">
                            {option.result.avatarImage?.name ? (
                              <AvatarImage
                                src={
                                  getPublicUrl(
                                    option.result.avatarImage.name,
                                  ) ?? ''
                                }
                                alt={option.result.name}
                              />
                            ) : null}
                            <AvatarFallback>
                              {option.result.name.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        }
                        title={option.result.name}
                        description={option.result?.user?.email || undefined}
                      />
                    )}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          )}
        </Combobox>

        {/* People list for current role */}
        <div className="flex flex-col gap-2">
          {!hasNoItems && (
            <span className="text-sm">{t('People with access')}</span>
          )}

          <div
            ref={setMemberListRoot}
            className="flex max-h-80 flex-col gap-2 overflow-y-auto"
          >
            {/* Staged items (not yet sent) */}
            {currentRoleItems.map((item) => (
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
                onRemove={() => handleRemoveItem(item.id)}
                removeLabel={t('Remove {name}', { name: item.name })}
              />
            ))}

            {/* Pending invites from server */}
            {currentRoleInvites.map((invite) => {
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

            {/* Existing members (loading skeletons while the first page of
                the selected role is pending) */}
            {isMembersPending && <MemberRowsSkeleton />}
            {currentRoleMembers.map((user) => (
              <PersonRow
                key={user.id}
                name={user.name ?? user.email ?? ''}
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
                onRemove={
                  !user.isOwner ? () => handleRemoveUser(user) : undefined
                }
                removeLabel={t('Remove {name}', {
                  name: user.name ?? user.email,
                })}
              />
            ))}

            {/* Infinite-scroll trigger: loads more members as the user
                scrolls inside the bounded list container */}
            {shouldShowTrigger && (
              <div
                ref={scrollTriggerRef}
                className="flex shrink-0 justify-center py-2"
              >
                {isFetchingNextPage && <Spinner className="size-4" />}
              </div>
            )}

            {/* Empty state */}
            {hasNoItems && selectedRoleName ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LuLeaf />
                  </EmptyMedia>
                  <EmptyDescription>
                    {t('No {roleName}s have been added', {
                      roleName: selectedRoleName,
                    })}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
        </div>
      </div>

      <DialogFooter className="flex-row items-center justify-between sm:justify-between">
        <div className="text-base">
          {totalPeople > 0
            ? t('{count, plural, =1 {1 person} other {# people}}', {
                count: totalPeople,
              })
            : null}
        </div>
        <Button
          onClick={handleSend}
          disabled={allSelectedItems.length === 0}
          loading={isSubmitting}
        >
          {isSubmitting ? t('Adding...') : t('Add')}
        </Button>
      </DialogFooter>
    </>
  );
}

function MemberRowsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-14 w-full shrink-0 rounded-lg" />
      ))}
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
        <Avatar className="size-6 shrink-0 sm:size-10">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
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
