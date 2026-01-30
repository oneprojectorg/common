'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useDebounce } from '@op/hooks';
import { Avatar } from '@op/ui/Avatar';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Popover } from '@op/ui/Popover';
import { SearchField } from '@op/ui/SearchField';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { toast } from '@op/ui/Toast';
import Image from 'next/image';
import {
  Key,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface SelectedItem {
  id: string;
  profileId: string;
  name: string;
  type: 'org' | 'individual';
  email?: string;
  avatarUrl?: string;
}

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
  const utils = trpc.useUtils();
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [isSubmitting, startTransition] = useTransition();
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch global roles and profile-specific roles in parallel
  const { data: globalRolesData, isPending: globalRolesPending } =
    trpc.profile.listRoles.useQuery({});
  const { data: profileRolesData, isPending: profileRolesPending } =
    trpc.profile.listRoles.useQuery({ profileId });

  const rolesPending = globalRolesPending || profileRolesPending;

  // Combine global and profile-specific roles
  const roles = useMemo(() => {
    const globalRoles = globalRolesData?.items ?? [];
    const profileRoles = profileRolesData?.items ?? [];
    return [...globalRoles, ...profileRoles];
  }, [globalRolesData, profileRolesData]);

  // Set default role when roles load
  useEffect(() => {
    const firstRole = roles[0];
    if (firstRole && !selectedRoleId) {
      setSelectedRoleId(firstRole.id);
    }
  }, [roles, selectedRoleId]);

  // Search profiles (orgs and individuals)
  const { data: searchResults, isFetching: isSearching } =
    trpc.profile.search.useQuery(
      { q: debouncedQuery, types: [EntityType.ORG, EntityType.INDIVIDUAL] },
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

  // Filter out already selected items
  const filteredResults = useMemo(() => {
    const selectedIds = new Set(selectedItems.map((item) => item.profileId));
    return flattenedResults.filter((result) => !selectedIds.has(result.id));
  }, [flattenedResults, selectedItems]);

  // Invite mutation
  const inviteMutation = trpc.profile.invite.useMutation();

  // Calculate total people count (each selection counts as 1)
  const totalPeople = selectedItems.length;

  const handleSelectItem = (result: (typeof flattenedResults)[0]) => {
    const newItem: SelectedItem = {
      id: `${result.entityType}-${result.id}`,
      profileId: result.id,
      name: result.name,
      type: result.entityType === EntityType.ORG ? 'org' : 'individual',
      email: result.user?.email ?? undefined,
      avatarUrl: result.avatarImage?.name
        ? getPublicUrl(result.avatarImage.name)
        : undefined,
    };

    setSelectedItems((prev) => [...prev, newItem]);
    setSearchQuery('');
  };

  const handleRemoveItem = (keys: Set<Key>) => {
    const keysArray = Array.from(keys);
    setSelectedItems((prev) =>
      prev.filter((item) => !keysArray.includes(item.id)),
    );
  };

  const handleSend = () => {
    // Get emails from selected individuals
    const emails = selectedItems
      .filter((item) => item.email)
      .map((item) => item.email!);

    if (emails.length === 0) {
      toast.error({ message: t('No email addresses to invite') });
      return;
    }

    startTransition(async () => {
      try {
        await inviteMutation.mutateAsync({
          emails,
          roleId: selectedRoleId,
          profileId,
        });

        toast.success({ message: t('Invite sent successfully') });
        setSelectedItems([]);
        setSearchQuery('');
        onOpenChange(false);

        // Invalidate the profile users list
        utils.profile.listUsers.invalidate({ profileId });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t('Failed to send invite');
        toast.error({ message });
      }
    });
  };

  const handleClose = () => {
    setSelectedItems([]);
    setSearchQuery('');
    onOpenChange(false);
  };

  const handleTabChange = (key: Key) => {
    setSelectedRoleId(String(key));
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      isDismissable
      className="sm:max-w-xl"
    >
      <ModalHeader>
        {t('Invite members to your decision-making process')}
      </ModalHeader>

      <ModalBody className="space-y-4">
        {/* Role Tabs */}
        {rolesPending ? (
          <div className="flex h-8 items-center">
            <LoadingSpinner className="size-4" />
            <span className="ml-2 text-sm text-neutral-gray4">
              {t('Loading roles...')}
            </span>
          </div>
        ) : (
          <Tabs
            selectedKey={selectedRoleId}
            onSelectionChange={handleTabChange}
          >
            <TabList>
              {roles.map((role) => {
                const countForRole = selectedItems.length;
                return (
                  <Tab key={role.id} id={role.id}>
                    {role.name}
                    {countForRole > 0 && selectedRoleId === role.id ? (
                      <span className="ml-1.5 min-w-4 rounded-full bg-teal-500 px-1.5 py-0.5 text-xs text-white">
                        {countForRole}
                      </span>
                    ) : null}
                  </Tab>
                );
              })}
            </TabList>
          </Tabs>
        )}

        {/* Search Input */}
        <div ref={searchContainerRef}>
          <SearchField
            placeholder={t('Find orgs and individuals or invite by email...')}
            value={searchQuery}
            onChange={setSearchQuery}
            className="w-full"
          />
        </div>

        {/* Search Results Dropdown */}
        <Popover
          triggerRef={searchContainerRef}
          isOpen={debouncedQuery.length >= 2}
          placement="bottom start"
          className="max-h-60 w-[var(--trigger-width)] overflow-y-auto border border-neutral-gray2 bg-white shadow-lg"
        >
          {isSearching ? (
            <div className="flex items-center justify-center p-4">
              <LoadingSpinner className="size-4" />
            </div>
          ) : filteredResults.length > 0 ? (
            <ListBox
              aria-label={t('Search results')}
              items={filteredResults}
              onAction={(key) => {
                const result = filteredResults.find((r) => r.id === key);
                if (result) {
                  handleSelectItem(result);
                }
              }}
              className="outline-none"
            >
              {(result) => (
                <ListBoxItem
                  key={result.id}
                  id={result.id}
                  textValue={result.name}
                  className="hover:bg-neutral-gray0 focus:bg-neutral-gray0 flex cursor-pointer items-center gap-3 px-4 py-3 outline-none"
                >
                  <Avatar placeholder={result.name} className="size-8 shrink-0">
                    {result.avatarImage?.name ? (
                      <Image
                        src={getPublicUrl(result.avatarImage.name) ?? ''}
                        alt={result.name}
                        fill
                        className="object-cover"
                      />
                    ) : null}
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium text-neutral-charcoal">
                      {result.name}
                    </span>
                    <span className="text-xs text-neutral-gray4">
                      {result.entityType === EntityType.ORG
                        ? t('Organization')
                        : t('Individual')}
                    </span>
                  </div>
                </ListBoxItem>
              )}
            </ListBox>
          ) : (
            <div className="p-4 text-center text-sm text-neutral-gray4">
              {t('No result')}
            </div>
          )}
        </Popover>

        {/* Selected Items */}
        {selectedItems.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-charcoal">
              {t('Selected members')}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex h-14 items-center gap-3 rounded-lg border border-neutral-gray2 bg-white px-3"
                >
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
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-neutral-charcoal">
                      {item.name}
                    </span>
                    {item.type === 'org' && (
                      <span className="text-xs text-neutral-gray4">
                        {t('Organization')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(new Set([item.id]))}
                    className="ml-1 rounded-full p-1 hover:bg-neutral-gray1"
                    aria-label={`Remove ${item.name}`}
                  >
                    <LuX className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between">
        <div className="text-sm text-neutral-black">
          {totalPeople > 0 ? t('{count} people', { count: totalPeople }) : null}
        </div>
        <Button
          color="primary"
          onPress={handleSend}
          isDisabled={selectedItems.length === 0 || !selectedRoleId}
          isPending={isSubmitting}
        >
          {isSubmitting ? t('Sending...') : t('Send')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
