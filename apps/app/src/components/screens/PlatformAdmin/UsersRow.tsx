'use client';

import type { RouterOutput } from '@op/api/client';
import { getAnalyticsUserUrl } from '@op/analytics/client-utils';
import { useRelativeTime } from '@op/hooks';
import { Menu, MenuItem, MenuSeparator } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { Select, SelectItem } from '@op/ui/Select';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import styles from './UsersTable.module.css';

// Infer types from tRPC router output
type ListAllUsersOutput = RouterOutput['platform']['admin']['listAllUsers'];
type User = ListAllUsersOutput['items'][number];
type OrganizationUsers = User['organizationUsers'];

export const UsersRow = ({ user }: { user: User }) => {
  const format = useFormatter();
  const t = useTranslations();
  const updatedAt = user.updatedAt ? new Date(user.updatedAt) : null;
  const relativeUpdatedAt = updatedAt ? useRelativeTime(updatedAt) : null;

  return (
    <div
      className={cn(
        'hover:bg-neutral-gray0 py-4 transition-colors',
        styles.usersTableGrid,
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
            <Button className="cursor-default text-sm font-normal underline decoration-dotted underline-offset-2 outline-none">
              {relativeUpdatedAt}
            </Button>
            <Tooltip>
              {format.dateTime(updatedAt, {
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
                window.open(getAnalyticsUserUrl(user.authUserId), '_blank');
              }}
              className="px-3 py-1"
            >
              {t('platformAdmin_actionViewAnalytics')}
            </MenuItem>
            <MenuItem
              key="edit-profile"
              onAction={() => {
                alert('coming soon');
              }}
              className="px-3 py-1"
            >
              {t('platformAdmin_actionEditProfile')}
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
