'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import { getAnalyticsUserUrl } from '@op/analytics/client-utils';
import type { RouterOutput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { useRelativeTime } from '@op/hooks';
import { Menu, MenuItem, MenuSeparator } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Select, SelectItem } from '@op/ui/Select';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { TableCell } from '@op/ui/ui/table';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { AddUserToOrgModal } from './AddUserToOrgModal';
import { UpdateProfileModal } from './UpdateProfile';

// Infer types from tRPC router output
type ListAllUsersOutput = RouterOutput['platform']['admin']['listAllUsers'];
type User = ListAllUsersOutput['items'][number];
type OrganizationUsers = User['organizationUsers'];

/** Renders table cells for a user row - must be used inside a <TableRow> */
export const UsersRowCells = ({ user }: { user: User }) => {
  const format = useFormatter();
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddToOrgModalOpen, setIsAddToOrgModalOpen] = useState(false);
  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const relativeCreatedAt = createdAt ? useRelativeTime(createdAt) : null;
  const lastSignInAt = user.authUser?.lastSignInAt
    ? new Date(user.authUser.lastSignInAt)
    : null;
  const relativeLastSignIn = lastSignInAt
    ? useRelativeTime(lastSignInAt)
    : null;

  return (
    <>
      <TableCell className="text-sm font-normal text-neutral-black">
        {user.profile?.name ?? user.name ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-black">
        {user.email}
      </TableCell>
      <UserRolesAndOrganizationCells
        organizationUsers={user.organizationUsers ?? []}
      />
      <TableCell className="text-sm font-normal text-neutral-charcoal">
        {createdAt ? (
          <TooltipTrigger>
            <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-hidden">
              {relativeCreatedAt}
            </Button>
            <Tooltip>
              {format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
            </Tooltip>
          </TooltipTrigger>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-charcoal">
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
      </TableCell>
      <TableCell className="text-sm text-neutral-charcoal">
        <div className="flex justify-end">
          <OptionMenu variant="outline" size="medium">
            <Menu className="min-w-48 p-2">
              <MenuItem
                key="view-analytics"
                onAction={() => {
                  window.open(getAnalyticsUserUrl(user.authUserId), '_blank');
                }}
                className="px-3 py-1"
              >
                {t('View analytics')}
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
                {t('Edit profile')}
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
                <span className="text-functional-red">{t('Remove user')}</span>
              </MenuItem>
            </Menu>
          </OptionMenu>
        </div>
        {user.profile ? (
          <UpdateProfileModal
            authUserId={user.authUserId}
            profile={user.profile}
            isOpen={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            onSuccess={() => {
              utils.platform.admin.listAllUsers.invalidate();
            }}
          />
        ) : null}
        <AddUserToOrgModal
          user={user}
          isOpen={isAddToOrgModalOpen}
          onOpenChange={setIsAddToOrgModalOpen}
        />
      </TableCell>
    </>
  );
};

const UserRolesAndOrganizationCells = ({
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
        <TableCell className="text-sm text-neutral-charcoal">-</TableCell>
        <TableCell className="text-sm text-neutral-charcoal">-</TableCell>
      </>
    );
  }

  const selectedOrgUser = organizationUsers.find(
    ({ id: orgUserId }) => orgUserId === selectedOrgUserId,
  );

  if (!selectedOrgUser) {
    return (
      <>
        <TableCell className="text-sm text-neutral-charcoal">
          Something went wrong
        </TableCell>
        <TableCell className="text-sm text-neutral-charcoal">
          Something went wrong
        </TableCell>
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
      <TableCell className="text-sm font-normal text-neutral-black">
        {roleNames}
      </TableCell>
      <TableCell className="text-sm font-normal text-neutral-black">
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
      </TableCell>
    </>
  );
};
