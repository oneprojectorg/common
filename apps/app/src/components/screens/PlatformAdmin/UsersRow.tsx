'use client';

import type { RouterOutput } from '@op/api/client';
import { useRelativeTime } from '@op/hooks';
import { Menu, MenuItem, MenuSeparator } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Select, SelectItem } from '@op/ui/Select';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { USER_TABLE_GRID_COLS } from './constants';

// Infer types from tRPC router output
type ListAllUsersOutput = RouterOutput['platform']['admin']['listAllUsers'];
type User = ListAllUsersOutput['items'][number];
type OrganizationUsers = User['organizationUsers'];
type UserRolesAndOrganizationsProps = {
  organizationUsers: OrganizationUsers;
};

type UserRowProps = {
  user: User;
};

export const UserRow = ({ user }: UserRowProps) => {
  const format = useFormatter();
  // We have to fix this at the database level to always have createdAt
  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const relativeCreatedAt = createdAt ? useRelativeTime(createdAt) : null;

  return (
    <div className={cn('hover:bg-neutral-gray0 grid gap-4 py-4 transition-colors', USER_TABLE_GRID_COLS)}>
      <div className="flex items-center text-sm text-neutral-black">
        {user.profile?.name ?? user.name ?? '—'}
      </div>
      <div className="flex items-center text-sm text-neutral-black">
        {user.email}
      </div>
      <UserRolesAndOrganizations
        organizationUsers={user.organizationUsers ?? []}
      />
      <div className="flex items-center text-sm text-neutral-charcoal">
        {createdAt ? (
          <TooltipTrigger>
            <Button className="cursor-default underline decoration-dotted underline-offset-2 outline-none">
              {relativeCreatedAt}
            </Button>
            <Tooltip>
              {format.dateTime(createdAt, {
                timeZone: 'UTC',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
              })}
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
                alert('action');
              }}
              className="px-3 py-1"
            >
              View analytics{' '}
            </MenuItem>
            <MenuItem
              key="edit-profile"
              onAction={() => {
                alert('action');
              }}
              className="px-3 py-1"
            >
              Edit profile{' '}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              key="toggle-'"
              onAction={() => {
                alert('action');
              }}
              className="px-3 py-1"
            >
              <span className="text-red-500">Remove User</span>
            </MenuItem>
          </Menu>
        </OptionMenu>
      </div>
    </div>
  );
};

const UserRolesAndOrganizations = ({
  organizationUsers,
}: UserRolesAndOrganizationsProps) => {
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
      <div className="flex items-center text-sm text-neutral-charcoal">
        {roleNames}
      </div>
      <div className="flex items-center text-sm text-neutral-charcoal">
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
