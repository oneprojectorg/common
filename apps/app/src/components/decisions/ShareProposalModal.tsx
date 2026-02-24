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
import { ListBox, ListBoxItem } from '@op/ui/RAC';
import { SearchField } from '@op/ui/SearchField';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import {
  Suspense,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { createPortal } from 'react-dom';
import { LuLink, LuUsers, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
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
  proposalTitle,
  isOpen,
  onOpenChange,
}: {
  proposalProfileId: string;
  proposalTitle: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
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
        {t('Share "{title}"', { title: proposalTitle || 'Untitled Proposal' })}
      </ModalHeader>

      <Suspense
        fallback={
          <ModalBody>
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner className="size-6" />
            </div>
          </ModalBody>
        }
      >
        <ShareProposalModalContent
          proposalProfileId={proposalProfileId}
          onOpenChange={onOpenChange}
        />
      </Suspense>
    </Modal>
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
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

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
      ...optimisticUsers.map((u) => u.email.toLowerCase()),
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
      ...optimisticUsers.map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);
    return !takenEmails.has(lowerQuery);
  }, [debouncedQuery, pendingInvites, optimisticUsers, optimisticInvites]);

  const inviteMutation = trpc.profile.invite.useMutation();
  const removeUserMutation = trpc.profile.removeUser.useMutation();
  const deleteInviteMutation = trpc.profile.deleteProfileInvite.useMutation();

  const handleSelectItem = (result: (typeof flattenedResults)[0]) => {
    if (!result.user?.email) {
      return;
    }
    setPendingInvites((prev) => [
      ...prev,
      {
        id: result.id,
        profileId: result.id,
        name: result.name,
        email: result.user!.email,
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

  const handleRemovePending = (id: string) => {
    setPendingInvites((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveExistingUser = (profileUserId: string) => {
    startTransition(async () => {
      dispatchRemoveUser(profileUserId);
      try {
        await removeUserMutation.mutateAsync({ profileUserId });
      } catch {
        toast.error({ message: t('Failed to remove user') });
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
        toast.error({ message: t('Failed to cancel invite') });
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
      toast.success({ message: t('Link copied to clipboard') });
    } catch {
      toast.error({ message: t('Failed to copy link') });
    }
  };

  const handleDone = async () => {
    if (pendingInvites.length === 0) {
      handleClose();
      return;
    }

    if (!memberRole) {
      toast.error({ message: t('Failed to send invite') });
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

      toast.success({ message: t('Invite sent successfully') });
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
      toast.error({ message });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) {
      return;
    }

    const takenEmails = new Set([
      ...pendingInvites.map((i) => i.email.toLowerCase()),
      ...optimisticUsers.map((u) => u.email.toLowerCase()),
      ...optimisticInvites.map((i) => i.email.toLowerCase()),
    ]);
    const newItems = parseEmailPaste(pastedText, takenEmails);
    if (!newItems) {
      return;
    }

    e.preventDefault();

    if (newItems.length > 0) {
      setPendingInvites((prev) => [...prev, ...newItems]);
    }

    setSearchQuery('');
  };

  const handleClose = () => {
    setPendingInvites([]);
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <>
      <ModalBody className="space-y-6">
        <div ref={searchContainerRef} onPaste={handlePaste}>
          <SearchField
            placeholder={t('Invite collaborators by name or email')}
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full"
          />
        </div>

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
              data-react-aria-top-layer="true"
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
                  className="border-0 p-0 outline-none"
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

        <div className="flex flex-col gap-2">
          <span className="text-sm text-neutral-black">
            {t('People with access')}
          </span>

          <div className="flex flex-col gap-2">
            {pendingInvites.map((item) => (
              <div
                key={item.id}
                className="flex h-14 items-center justify-between gap-4 rounded-lg border border-neutral-gray1 bg-white px-3 py-2"
              >
                <ProfileItem
                  size="small"
                  avatar={
                    <Avatar placeholder={item.name} className="size-6 shrink-0">
                      {item.avatarUrl ? (
                        <Image
                          src={item.avatarUrl}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      ) : null}
                    </Avatar>
                  }
                  title={item.name}
                >
                  {item.name !== item.email && (
                    <div className="text-sm text-neutral-gray4">
                      {item.email}
                    </div>
                  )}
                </ProfileItem>
                <IconButton
                  size="small"
                  onPress={() => handleRemovePending(item.id)}
                  aria-label={t('Remove {name}', { name: item.name })}
                >
                  <LuX className="size-4" />
                </IconButton>
              </div>
            ))}

            {optimisticInvites.map((invite) => {
              const displayName = invite.inviteeProfile?.name ?? invite.email;
              const avatarUrl = invite.inviteeProfile?.avatarImage?.name
                ? getPublicUrl(invite.inviteeProfile.avatarImage.name)
                : undefined;

              return (
                <div
                  key={invite.id}
                  className="flex h-14 items-center justify-between gap-4 rounded-lg border border-neutral-gray1 bg-white px-3 py-2"
                >
                  <ProfileItem
                    size="small"
                    avatar={
                      <Avatar
                        placeholder={displayName}
                        className="size-6 shrink-0"
                      >
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={displayName}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </Avatar>
                    }
                    title={displayName}
                  >
                    {invite.inviteeProfile?.name && (
                      <div className="text-sm text-neutral-gray4">
                        {invite.email} <Bullet />{' '}
                        <span className="text-sm text-neutral-gray4">
                          {t('Invited')}
                        </span>
                      </div>
                    )}
                  </ProfileItem>
                  <IconButton
                    size="small"
                    onPress={() => handleDeleteInvite(invite.id)}
                    aria-label={t('Remove {name}', { name: displayName })}
                  >
                    <LuX className="size-4" />
                  </IconButton>
                </div>
              );
            })}

            {optimisticUsers.length === 0 &&
            pendingInvites.length === 0 &&
            optimisticInvites.length === 0 ? (
              <EmptyState icon={<LuUsers />}>
                {t('No one has been invited yet')}
              </EmptyState>
            ) : (
              optimisticUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex h-14 items-center justify-between gap-4 rounded-lg border border-neutral-gray1 bg-white px-3 py-2"
                >
                  <ProfileItem
                    size="small"
                    avatar={
                      <Avatar
                        placeholder={user.name ?? user.email}
                        className="size-6 shrink-0"
                      >
                        {user.profile?.avatarImage?.name ? (
                          <Image
                            src={
                              getPublicUrl(user.profile.avatarImage.name) ?? ''
                            }
                            alt={user.name ?? user.email}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </Avatar>
                    }
                    title={user.name ?? user.email}
                  >
                    {user.name && (
                      <div className="text-sm text-neutral-gray4">
                        {user.email}
                      </div>
                    )}
                  </ProfileItem>
                  {!user.isOwner && (
                    <IconButton
                      size="small"
                      onPress={() => handleRemoveExistingUser(user.id)}
                      aria-label={t('Remove {name}', {
                        name: user.name ?? user.email,
                      })}
                    >
                      <LuX className="size-4" />
                    </IconButton>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="flex-row items-center justify-between">
        <Button color="secondary" onPress={handleCopyLink}>
          <LuLink className="size-4" />
          {t('Copy link')}
        </Button>
        <Button
          color="primary"
          onPress={handleDone}
          isDisabled={inviteMutation.isPending}
        >
          {inviteMutation.isPending ? (
            <LoadingSpinner className="size-4" />
          ) : (
            t('Done')
          )}
        </Button>
      </ModalFooter>
    </>
  );
}
