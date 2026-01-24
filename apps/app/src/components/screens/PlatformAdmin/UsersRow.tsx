'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import { getAnalyticsUserUrl } from '@op/analytics/client-utils';
import type { RouterOutput } from '@op/api/client';
import { trpcOptions } from '@op/api/trpcTanstackQuery';
import { useRelativeTime } from '@op/hooks';
import { Menu, MenuItem, MenuSeparator } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Select, SelectItem } from '@op/ui/Select';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { AddUserToOrgModal } from './AddUserToOrgModal';
import { UpdateProfileModal } from './UpdateProfile';

const USERS_TABLE_GRID =
  'grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.5fr)_minmax(100px,0.8fr)_minmax(200px,2.2fr)_minmax(80px,0.5fr)_minmax(80px,0.5fr)_80px] gap-4';

// Infer types from tRPC router output
type ListAllUsersOutput = RouterOutput['platform']['admin']['listAllUsers'];
type User = ListAllUsersOutput['items'][number];
type OrganizationUsers = User['organizationUsers'];

export const UsersRow = ({ user }: { user: User }) => {
  const format = useFormatter();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddToOrgModalOpen, setIsAddToOrgModalOpen] = useState(false);
  const updatedAt = user.updatedAt ? new Date(user.updatedAt) : null;
  const relativeUpdatedAt = updatedAt ? useRelativeTime(updatedAt) : null;
  const lastSignInAt = user.authUser?.lastSignInAt
    ? new Date(user.authUser.lastSignInAt)
    : null;
  const relativeLastSignIn = lastSignInAt
    ? useRelativeTime(lastSignInAt)
    : null;

  return (
    <>
      <div
        className={cn(
          'hover:bg-neutral-gray0 py-4 transition-colors',
          USERS_TABLE_GRID,
        )}
      >
        <div className="flex items-center text-sm font-normal text-neutral-black">
          {user.profile?.name ?? user.name ?? '—'}
        </div>
        <div className="flex items-center text-sm font-normal text-neutral-black">
          {user.email}
        </div>
        <UserRolesAndOrganizations
          organizationUsers={user.organizationUsers ?? []}
        />
        <div className="flex items-center text-sm font-normal text-neutral-charcoal">
          {updatedAt ? (
            <TooltipTrigger>
              <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-hidden">
                {relativeUpdatedAt}
              </Button>
              <Tooltip>
                {format.dateTime(updatedAt, DATE_TIME_UTC_FORMAT)}
              </Tooltip>
            </TooltipTrigger>
          ) : (
            '—'
          )}
        </div>
        <div className="flex items-center text-sm font-normal text-neutral-charcoal">
          {lastSignInAt ? (
            <TooltipTrigger>
              <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-hidden">
                {relativeLastSignIn}
              </Button>
              <Tooltip>
                {format.dateTime(lastSignInAt, DATE_TIME_UTC_FORMAT)}
              </Tooltip>
            </TooltipTrigger>
          ) : (
            '—'
          )}
        </div>
        <div className="flex items-center justify-end pr-1 text-sm text-neutral-charcoal">
          <OptionMenu variant="outline" size="medium">
            <Menu className="min-w-48 p-2">
              <MenuItem
                key="view-analytics"
                onAction={() => {
                  window.open(getAnalyticsUserUrl(user.authUserId), '_blank');
                }}
                className="px-3 py-1"
              >
                {t('platformAdmin_actionViewAnalytics')}
              </MenuItem>
              <MenuItem
                key="edit-profile"
                onAction={() => {
                  if (user.profile) {
                    setIsEditModalOpen(true);
                  }
                }}
                className="px-3 py-1"
                isDisabled={!user.profile}
              >
                {t('platformAdmin_actionEditProfile')}
              </MenuItem>
              <MenuItem
                key="add-to-org"
                onAction={() => {
                  setIsAddToOrgModalOpen(true);
                }}
                className="px-3 py-1"
              >
                Add to Organization
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                key="remove-user"
                onAction={() => {
                  alert('coming soon');
                }}
                className="px-3 py-1"
              >
                <span className="text-red-500">
                  {t('platformAdmin_actionRemoveUser')}
                </span>
              </MenuItem>
            </Menu>
          </OptionMenu>
        </div>
      </div>
      {user.profile ? (
        <UpdateProfileModal
          userId={user.id}
          authUserId={user.authUserId}
          profile={user.profile}
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          onSuccess={() => {
            queryClient.invalidateQueries(
              trpcOptions.platform.admin.listAllUsers.queryFilter(),
            );
          }}
        />
      ) : null}
      <AddUserToOrgModal
        user={user}
        isOpen={isAddToOrgModalOpen}
        onOpenChange={setIsAddToOrgModalOpen}
      />
    </>
  );
};

const UserRolesAndOrganizations = ({
  organizationUsers,
}: {
  organizationUsers: OrganizationUsers;
}) => {
  const [selectedOrgUserId, setSelectedOrgUserId] = useState<
    string | undefined
  >(organizationUsers?.[0]?.id);

  if (!organizationUsers || organizationUsers.length === 0) {
    return (
      <>
        <div className="flex items-center text-sm text-neutral-charcoal">-</div>
        <div className="flex items-center text-sm text-neutral-charcoal">-</div>
      </>
    );
  }

  const selectedOrgUser = organizationUsers.find(
    ({ id: orgUserId }) => orgUserId === selectedOrgUserId,
  );

  // Something was wrong with the data/api. We should never reach here but I left it so that we can investigate if needed.
  // Eventually we should assertDefined(selectedOrgUser).
  if (!selectedOrgUser) {
    return (
      <>
        <div className="flex items-center text-sm text-neutral-charcoal">
          Something went wrong
        </div>
        <div className="flex items-center text-sm text-neutral-charcoal">
          Something went wrong
        </div>
      </>
    );
  }

  const roles = selectedOrgUser.roles;
  const roleNames =
    roles && roles.length > 0
      ? roles.map((roleJunction) => roleJunction.accessRole.name).join(', ')
      : 'No roles';

  return (
    <>
      <div className="flex items-center text-sm font-normal text-neutral-black">
        {roleNames}
      </div>
      <div className="flex items-center text-sm font-normal text-neutral-black">
        <Select
          className="w-full"
          defaultSelectedKey={selectedOrgUserId}
          onSelectionChange={(key) => setSelectedOrgUserId(String(key))}
        >
          {organizationUsers.map(({ id: orgUserId, organization }) => (
            <SelectItem key={orgUserId} id={orgUserId}>
              {organization?.profile?.name ?? 'Unknown Organization'}
            </SelectItem>
          ))}
        </Select>
      </div>
    </>
  );
};
