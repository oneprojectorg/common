'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import { getAnalyticsUserUrl } from '@op/analytics/client-utils';
import type { RouterOutput } from '@op/api/client';
import { trpc } from '@op/api/client';
import { useRelativeTime } from '@op/hooks';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { TableCell } from '@op/sense/Table';
import { toast } from '@op/sense/Toast';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import { LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AddUserToOrgModal } from './AddUserToOrgModal';
import { TimestampTooltip } from './TimestampTooltip';
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
  const lastSignInAt = user.lastSignInAt ? new Date(user.lastSignInAt) : null;
  const relativeLastSignIn = lastSignInAt
    ? useRelativeTime(lastSignInAt)
    : null;

  return (
    <>
      <TableCell className="text-sm font-normal text-foreground">
        {user.profile?.name ?? user.name ?? '—'}
      </TableCell>
      <TableCell className="text-sm font-normal text-foreground">
        {user.email}
      </TableCell>
      <UserRolesAndOrganizationCells
        organizationUsers={user.organizationUsers ?? []}
      />
      <TableCell className="text-sm font-normal text-muted-foreground">
        {createdAt ? (
          <TimestampTooltip
            className="text-sm font-normal"
            title={format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
          >
            {relativeCreatedAt}
          </TimestampTooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-sm font-normal text-muted-foreground">
        {lastSignInAt ? (
          <TimestampTooltip
            className="text-sm font-normal"
            title={format.dateTime(lastSignInAt, DATE_TIME_UTC_FORMAT)}
          >
            {relativeLastSignIn}
          </TimestampTooltip>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('User options')}
                >
                  <LuEllipsis />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem
                disabled={!user.profile}
                onClick={() => {
                  if (user.profile) {
                    setIsEditModalOpen(true);
                  }
                }}
              >
                {t('Edit profile')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAddToOrgModalOpen(true)}>
                {t('Add to organization')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(user.authUserId);
                  toast.success(t('Auth user ID copied to your clipboard.'));
                }}
              >
                {t('Copy authUserId')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.open(getAnalyticsUserUrl(user.authUserId), '_blank');
                }}
              >
                {t('View analytics')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  alert('coming soon');
                }}
              >
                {t('Remove user')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <TableCell className="text-sm text-muted-foreground">-</TableCell>
        <TableCell className="text-sm text-muted-foreground">-</TableCell>
      </>
    );
  }

  const selectedOrgUser = organizationUsers.find(
    ({ id: orgUserId }) => orgUserId === selectedOrgUserId,
  );

  if (!selectedOrgUser) {
    return (
      <>
        <TableCell className="text-sm text-muted-foreground">
          Something went wrong
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
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

  const orgItems = organizationUsers.map(({ id: orgUserId, organization }) => ({
    value: orgUserId,
    label: organization?.profile?.name ?? 'Unknown Organization',
  }));

  return (
    <>
      <TableCell className="text-sm font-normal text-foreground">
        {roleNames}
      </TableCell>
      <TableCell className="text-sm font-normal text-foreground">
        <Select
          items={orgItems}
          defaultValue={selectedOrgUserId}
          onValueChange={(value) => setSelectedOrgUserId(value ?? undefined)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {orgItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </TableCell>
    </>
  );
};
