'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useDebounce } from '@op/hooks';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { IconButton } from '@op/ui/IconButton';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { ProfileItem } from '@op/ui/ProfileItem';
import { SearchField } from '@op/ui/SearchField';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import {
  Key,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';
import { createPortal } from 'react-dom';
import { LuLeaf, LuX } from 'react-icons/lu';

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
  isOpen,
  onOpenChange,
}: {
  profileId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      isDismissable
      className="sm:max-w-xl"
    >
      <ModalHeader className="truncate">
        {t('Invite participants to your decision-making process')}
      </ModalHeader>

      <ErrorBoundary>
        <Suspense
          fallback={
            <ModalBody className="space-y-6">
              <RoleSelectorSkeleton />
              <div className="flex items-center justify-center p-8">
                <LoadingSpinner className="size-6" />
              </div>
            </ModalBody>
          }
        >
          <ProfileInviteModalContent
            profileId={profileId}
            onOpenChange={onOpenChange}
          />
        </Suspense>
      </ErrorBoundary>
    </Modal>
  );
};

function ProfileInviteModalContent({
  profileId,
  onOpenChange,
}: {
  profileId: string;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [selectedItemsByRole, setSelectedItemsByRole] =
    useState<SelectedItemsByRole>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [isSubmitting, startSendTransition] = useTransition();
  const [, startOptimisticTransition] = useTransition();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  // Fetch existing pending invites and members
  const [serverInvites] = trpc.profile.listProfileInvites.useSuspenseQuery({
    profileId,
  });
  const [usersData] = trpc.profile.listUsers.useSuspenseQuery({ profileId });

  const [optimisticInvites, dispatchRemoveInvite] = useOptimistic(
    serverInvites,
    (state, inviteId: string) => state.filter((i) => i.id !== inviteId),
  );

  const [optimisticUsers, dispatchRemoveUser] = useOptimistic(
    usersData.items,
    (state, profileUserId: string) =>
      state.filter((u) => u.id !== profileUserId),
  );

  // Get items for current role
  const currentRoleItems = selectedItemsByRole[selectedRoleId] ?? [];

  // Get all selected items across all roles (for filtering duplicates)
  const allSelectedItems = useMemo(
    () => Object.values(selectedItemsByRole).flat(),
    [selectedItemsByRole],
  );

  // Filter server invites by current role
  const currentRoleInvites = useMemo(
    () => optimisticInvites.filter((i) => i.accessRoleId === selectedRoleId),
    [optimisticInvites, selectedRoleId],
  );

  // Filter members by current role
  const currentRoleMembers = useMemo(
    () =>
      optimisticUsers.filter((u) =>
        u.roles.some((r) => r.id === selectedRoleId),
      ),
    [optimisticUsers, selectedRoleId],
  );

  // Update dropdown position when search query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2 && searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [debouncedQuery]);

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

  // Filter out already selected, already invited, and existing members
  const filteredResults = useMemo(() => {
    const selectedIds = new Set(allSelectedItems.map((item) => item.profileId));
    const selectedEmails = new Set(
      allSelectedItems.map((item) => item.email.toLowerCase()),
    );
    const existingUserEmails = new Set(
      optimisticUsers.map((u) => u.email.toLowerCase()),
    );
    const invitedEmails = new Set(
      optimisticInvites.map((i) => i.email.toLowerCase()),
    );
    return flattenedResults.filter(
      (result) =>
        !selectedIds.has(result.id) &&
        (!result.user?.email ||
          (!selectedEmails.has(result.user.email.toLowerCase()) &&
            !existingUserEmails.has(result.user.email.toLowerCase()) &&
            !invitedEmails.has(result.user.email.toLowerCase()))),
    );
  }, [flattenedResults, allSelectedItems, optimisticUsers, optimisticInvites]);

  // Check if query is a valid email that hasn't been selected yet (across all roles)
  const canAddEmail = useMemo(() => {
    if (!isValidEmail(debouncedQuery)) {
      return false;
    }
    const lowerQuery = debouncedQuery.toLowerCase();
    const takenEmails = new Set([
      ...allSelectedItems.map((item) => item.email.toLowerCase()),
      ...optimisticUsers.map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);
    return !takenEmails.has(lowerQuery);
  }, [debouncedQuery, allSelectedItems, optimisticUsers, optimisticInvites]);

  // Mutations
  const inviteMutation = trpc.profile.invite.useMutation();
  const deleteInviteMutation = trpc.profile.deleteProfileInvite.useMutation();
  const removeUserMutation = trpc.profile.removeUser.useMutation();

  // Calculate total people count across all roles (staged only)
  const totalPeople = allSelectedItems.length;

  // Calculate counts by role for the tab badges (staged + server invites + members)
  const countsByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [roleId, items] of Object.entries(selectedItemsByRole)) {
      counts[roleId] = items.length;
    }
    for (const invite of optimisticInvites) {
      counts[invite.accessRoleId] = (counts[invite.accessRoleId] ?? 0) + 1;
    }
    for (const user of optimisticUsers) {
      for (const role of user.roles) {
        counts[role.id] = (counts[role.id] ?? 0) + 1;
      }
    }
    return counts;
  }, [selectedItemsByRole, optimisticInvites, optimisticUsers]);

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
        toast.error({ message: t('Failed to cancel invite') });
      }
      await utils.profile.listProfileInvites.invalidate({ profileId });
    });
  };

  const handleRemoveUser = (profileUserId: string) => {
    startOptimisticTransition(async () => {
      dispatchRemoveUser(profileUserId);
      try {
        await removeUserMutation.mutateAsync({ profileUserId });
      } catch {
        toast.error({ message: t('Failed to remove user') });
      }
      await utils.profile.listUsers.invalidate({ profileId });
    });
  };

  const handleSend = () => {
    startSendTransition(async () => {
      try {
        // Collect all invitations across all roles into a single array
        const invitations = Object.entries(selectedItemsByRole)
          .filter(([, items]) => items.length > 0)
          .flatMap(([roleId, items]) =>
            items.map((item) => ({ email: item.email, roleId })),
          );

        if (invitations.length === 0) {
          return;
        }

        await inviteMutation.mutateAsync({
          invitations,
          profileId,
        });

        toast.success({ message: t('Invite sent successfully') });
        setSelectedItemsByRole({});
        setSearchQuery('');
        onOpenChange(false);

        // Invalidate both lists
        utils.profile.listUsers.invalidate({ profileId });
        utils.profile.listProfileInvites.invalidate({ profileId });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('Failed to send invite');
        toast.error({ message });
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText || !selectedRoleId) {
      return;
    }

    const existingEmails = new Set([
      ...allSelectedItems.map((item) => item.email.toLowerCase()),
      ...optimisticUsers.map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);
    const emails = parseEmailPaste(pastedText, existingEmails);
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

  const handleTabChange = (key: Key) => {
    setSelectedRoleId(String(key));
  };

  const hasNoItems =
    currentRoleItems.length === 0 &&
    currentRoleInvites.length === 0 &&
    currentRoleMembers.length === 0;

  return (
    <>
      <ModalBody className="space-y-6">
        {/* Role Tabs */}
        <RoleSelector
          profileId={profileId}
          selectedRoleId={selectedRoleId}
          onSelectionChange={handleTabChange}
          countsByRole={countsByRole}
          onRolesLoaded={(roleId, roleName) => {
            setSelectedRoleId(roleId);
            setSelectedRoleName(roleName);
          }}
          onRoleNameChange={setSelectedRoleName}
        />

        {/* Search Input */}
        <div ref={searchContainerRef} onPaste={handlePaste}>
          <SearchField
            placeholder={t('Search by name or email...')}
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full"
          />
        </div>

        {/* Search Results Dropdown - rendered via portal to escape modal overflow */}
        {debouncedQuery.length >= 2 &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed z-[9999999] mt-1 max-h-60 overflow-y-auto rounded-lg border border-neutral-gray1 bg-white shadow-lg"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
              // Mark as top-layer overlay so React Aria doesn't treat clicks as "outside"
              data-react-aria-top-layer="true"
              // Prevent clicks from bubbling to modal overlay and dismissing it
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {isSearching ? (
                <div className="flex items-center justify-center p-4">
                  <LoadingSpinner className="size-4" />
                </div>
              ) : filteredResults.length > 0 || canAddEmail ? (
                <ListBox
                  aria-label={t('Search results')}
                  onAction={(key) => {
                    if (key === 'add-email') {
                      handleAddEmail(debouncedQuery);
                    } else {
                      const result = filteredResults.find((r) => r.id === key);
                      if (result) {
                        handleSelectItem(result);
                      }
                    }
                  }}
                  className="outline-none"
                >
                  {canAddEmail && (
                    <ListBoxItem
                      id="add-email"
                      textValue={debouncedQuery}
                      className="hover:bg-neutral-gray0 focus:bg-neutral-gray0 cursor-pointer px-4 py-3 outline-none"
                    >
                      <div className="text-sm">
                        {t('Invite {email}', { email: debouncedQuery })}
                      </div>
                    </ListBoxItem>
                  )}
                  {filteredResults.map((result) => (
                    <ListBoxItem
                      key={result.id}
                      id={result.id}
                      textValue={result.name}
                      className="hover:bg-neutral-gray0 focus:bg-neutral-gray0 cursor-pointer px-4 py-3 outline-none"
                    >
                      <ProfileItem
                        size="small"
                        avatar={
                          <Avatar
                            placeholder={result.name}
                            className="size-8 shrink-0"
                          >
                            {result.avatarImage?.name ? (
                              <Image
                                src={
                                  getPublicUrl(result.avatarImage.name) ?? ''
                                }
                                alt={result.name}
                                fill
                                className="object-cover"
                              />
                            ) : null}
                          </Avatar>
                        }
                        title={result.name}
                      />
                    </ListBoxItem>
                  ))}
                </ListBox>
              ) : (
                <div className="p-4 text-center text-sm text-neutral-gray4">
                  {t('No results')}
                </div>
              )}
            </div>,
            document.body,
          )}

        {/* People list for current role */}
        <div className="flex flex-col gap-2">
          {!hasNoItems && (
            <span className="text-sm text-neutral-black">
              {t('People with access')}
            </span>
          )}

          <div className="flex flex-col gap-2">
            {/* Staged items (not yet sent) */}
            {currentRoleItems.map((item) => (
              <PersonRow
                key={item.id}
                name={item.name}
                avatarUrl={item.avatarUrl}
                subtitle={
                  item.name !== item.email ? (
                    <div className="text-sm text-neutral-gray4">
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
                    <div className="text-sm text-neutral-gray4">
                      {invite.inviteeProfile?.name && (
                        <>
                          {invite.email} <Bullet />{' '}
                        </>
                      )}
                      <span className="text-sm text-neutral-gray4">
                        {t('Invited')}
                      </span>
                    </div>
                  }
                  onRemove={() => handleDeleteInvite(invite.id)}
                  removeLabel={t('Remove {name}', { name: displayName })}
                />
              );
            })}

            {/* Existing members */}
            {currentRoleMembers.map((user) => (
              <PersonRow
                key={user.id}
                name={user.name ?? user.email}
                avatarUrl={
                  user.profile?.avatarImage?.name
                    ? getPublicUrl(user.profile.avatarImage.name)
                    : undefined
                }
                subtitle={
                  user.name ? (
                    <div className="text-sm text-neutral-gray4">
                      {user.email}
                    </div>
                  ) : undefined
                }
                onRemove={
                  !user.isOwner ? () => handleRemoveUser(user.id) : undefined
                }
                removeLabel={t('Remove {name}', {
                  name: user.name ?? user.email,
                })}
              />
            ))}

            {/* Empty state */}
            {hasNoItems && selectedRoleName ? (
              <EmptyState icon={<LuLeaf />}>
                {t('No {roleName}s have been added', {
                  roleName: selectedRoleName,
                })}
              </EmptyState>
            ) : null}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="flex-row items-center justify-between">
        <div className="text-base text-neutral-black">
          {totalPeople > 0
            ? t('{count, plural, =1 {1 person} other {# people}}', {
                count: totalPeople,
              })
            : null}
        </div>
        <Button
          color="primary"
          onPress={handleSend}
          isDisabled={allSelectedItems.length === 0}
          isPending={isSubmitting}
        >
          {isSubmitting ? t('Sending...') : t('Send')}
        </Button>
      </ModalFooter>
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
    <div className="flex h-14 items-center justify-between gap-4 rounded-lg border border-neutral-gray1 bg-white px-3 py-2">
      <ProfileItem
        size="small"
        avatar={
          <Avatar placeholder={name} className="size-6 shrink-0">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} fill className="object-cover" />
            ) : null}
          </Avatar>
        }
        title={name}
      >
        {subtitle}
      </ProfileItem>
      {onRemove && (
        <IconButton size="small" onPress={onRemove} aria-label={removeLabel}>
          <LuX className="size-4" />
        </IconButton>
      )}
    </div>
  );
}
