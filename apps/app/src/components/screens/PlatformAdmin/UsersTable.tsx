'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import { getAnalyticsUserUrl } from '@op/analytics/client-utils';
import { type RouterOutput, trpc } from '@op/api/client';
import { useCursorPagination, useDebounce, useRelativeTime } from '@op/hooks';
import { type ColumnDef, DataTable } from '@op/ui-next/DataTable';
import { Header2 } from '@op/ui-next/Header';
import { DropdownMenuItem, DropdownMenuSeparator } from '@op/ui-next/Menu';
import { OptionMenu } from '@op/ui-next/OptionMenu';
import { Pagination } from '@op/ui-next/Pagination';
import { SearchField } from '@op/ui-next/SearchField';
import { Select, SelectItem } from '@op/ui-next/Select';
import { Skeleton } from '@op/ui-next/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/ui-next/Table';
import { toast } from '@op/ui-next/Toast';
import { Tooltip, TooltipTrigger } from '@op/ui-next/Tooltip';
import { useFormatter } from 'next-intl';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Button } from 'react-aria-components';
import { LuDownload } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AddUserToOrgModal } from './AddUserToOrgModal';
import { UpdateProfileModal } from './UpdateProfile';

type ListAllUsersOutput = RouterOutput['platform']['admin']['listAllUsers'];
type User = ListAllUsersOutput['items'][number];

const exportUsersToCSV = (
  users: Array<{ name: string | null; email: string }>,
) => {
  const header = 'name,email\n';
  const rows = users
    .map((user) => {
      const name = user.name?.replace(/"/g, '""') ?? '';
      const email = user.email.replace(/"/g, '""');
      return `"${name}","${email}"`;
    })
    .join('\n');

  const csvContent = header + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const UsersTable = () => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);
  const [isExporting, startExportTransition] = useTransition();

  const handleExportAllUsers = useCallback(() => {
    startExportTransition(async () => {
      try {
        const result = await utils.platform.admin.listAllUsers.fetch({});

        if (result.items.length === 0) {
          return;
        }

        const allUsers = result.items.map((user) => ({
          name: user.profile?.name ?? user.name,
          email: user.email,
        }));

        exportUsersToCSV(allUsers);
        toast.success({ message: t('Users exported successfully') });
      } catch (error) {
        console.error('Export failed:', error);
        toast.error({ message: t('Failed to export users') });
      }
    });
  }, [utils, t]);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-md font-serif">
          {t('platformAdmin_allUsers')}
        </Header2>
        <div className="flex items-center gap-2">
          <div className="w-64">
            <SearchField
              aria-label={t('Search users by name or email')}
              placeholder={t('Search users by name or email')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <OptionMenu
            aria-label={t('User options')}
            variant="outline"
            size="medium"
            className="mr-1"
          >
            <DropdownMenuItem
              onClick={handleExportAllUsers}
              disabled={isExporting}
            >
              <LuDownload className="size-4" />
              {t('Export all users')}
            </DropdownMenuItem>
          </OptionMenu>
        </div>
      </div>
      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTableContent searchQuery={debouncedQuery} />
      </Suspense>
    </div>
  );
};

const UsersTableContent = ({ searchQuery }: { searchQuery: string }) => {
  const t = useTranslations();
  const {
    cursor,
    currentPage,
    limit,
    handleNext,
    handlePrevious,
    canGoPrevious,
    reset,
  } = useCursorPagination(5);

  useEffect(() => {
    reset();
  }, [searchQuery]);

  const [data] = trpc.platform.admin.listAllUsers.useSuspenseQuery({
    cursor,
    limit,
    query: searchQuery || undefined,
  });

  const { items: users, next, total } = data;

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  const [selectedOrgUserByUser, setSelectedOrgUserByUser] = useState<
    Record<string, string>
  >({});

  const getSelectedOrgUserId = (user: User) => {
    const fromState = selectedOrgUserByUser[user.id];
    if (fromState) {
      return fromState;
    }
    return user.organizationUsers?.[0]?.id;
  };

  const setSelectedOrgUserId = (userId: string, orgUserId: string) => {
    setSelectedOrgUserByUser((prev) => ({ ...prev, [userId]: orgUserId }));
  };

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('Name'),
        cell: ({ row }) => (
          <span className="text-sm font-normal text-neutral-black">
            {row.original.profile?.name ?? row.original.name ?? '—'}
          </span>
        ),
      },
      {
        id: 'email',
        header: t('Email'),
        cell: ({ row }) => (
          <span className="text-sm font-normal text-neutral-black">
            {row.original.email}
          </span>
        ),
      },
      {
        id: 'role',
        header: t('Role'),
        cell: ({ row }) => (
          <RoleCell
            user={row.original}
            selectedOrgUserId={getSelectedOrgUserId(row.original)}
          />
        ),
      },
      {
        id: 'organization',
        header: t('Organization'),
        cell: ({ row }) => (
          <OrganizationCell
            user={row.original}
            selectedOrgUserId={getSelectedOrgUserId(row.original)}
            onChange={(orgUserId) =>
              setSelectedOrgUserId(row.original.id, orgUserId)
            }
          />
        ),
      },
      {
        id: 'created',
        header: t('Created'),
        cell: ({ row }) => <CreatedCell user={row.original} />,
      },
      {
        id: 'lastSignIn',
        header: t('Last sign in'),
        cell: ({ row }) => <LastSignInCell user={row.original} />,
      },
      {
        id: 'actions',
        header: () => <span className="block text-right">{t('Actions')}</span>,
        cell: ({ row }) => <UserActionsCell user={row.original} />,
      },
    ],
    [t, selectedOrgUserByUser],
  );

  return (
    <>
      <DataTable
        aria-label={t('platformAdmin_allUsers')}
        columns={columns}
        data={users}
        getRowId={(user) => user.id}
      />
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('users'),
          }}
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

const RoleCell = ({
  user,
  selectedOrgUserId,
}: {
  user: User;
  selectedOrgUserId?: string;
}) => {
  const orgUsers = user.organizationUsers ?? [];
  if (orgUsers.length === 0) {
    return <span className="text-sm text-neutral-charcoal">-</span>;
  }
  const selected = orgUsers.find((ou) => ou.id === selectedOrgUserId);
  if (!selected) {
    return <span className="text-sm text-neutral-charcoal">—</span>;
  }
  const roles = selected.roles;
  const roleNames =
    roles && roles.length > 0
      ? roles.map((r) => r.accessRole.name).join(', ')
      : 'No roles';
  return (
    <span className="text-sm font-normal text-neutral-black">{roleNames}</span>
  );
};

const OrganizationCell = ({
  user,
  selectedOrgUserId,
  onChange,
}: {
  user: User;
  selectedOrgUserId?: string;
  onChange: (orgUserId: string) => void;
}) => {
  const orgUsers = user.organizationUsers ?? [];
  if (orgUsers.length === 0) {
    return <span className="text-sm text-neutral-charcoal">-</span>;
  }
  return (
    <Select
      className="w-full"
      selectedKey={selectedOrgUserId}
      onSelectionChange={(key) => onChange(String(key))}
    >
      {orgUsers.map(({ id: orgUserId, organization }) => (
        <SelectItem key={orgUserId} id={orgUserId}>
          {organization?.profile?.name ?? 'Unknown Organization'}
        </SelectItem>
      ))}
    </Select>
  );
};

const CreatedCell = ({ user }: { user: User }) => {
  const format = useFormatter();
  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const relativeCreatedAt = useRelativeTime(createdAt ?? new Date());
  if (!createdAt) {
    return <span className="text-sm font-normal text-neutral-charcoal">—</span>;
  }
  return (
    <TooltipTrigger>
      <Button className="cursor-default text-sm font-normal text-neutral-charcoal underline decoration-dotted underline-offset-2 outline-hidden">
        {relativeCreatedAt}
      </Button>
      <Tooltip>{format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}</Tooltip>
    </TooltipTrigger>
  );
};

const LastSignInCell = ({ user }: { user: User }) => {
  const format = useFormatter();
  const lastSignInAt = user.authUser?.lastSignInAt
    ? new Date(user.authUser.lastSignInAt)
    : null;
  const relative = useRelativeTime(lastSignInAt ?? new Date());
  if (!lastSignInAt) {
    return <span className="text-sm font-normal text-neutral-charcoal">—</span>;
  }
  return (
    <TooltipTrigger>
      <Button className="cursor-default text-sm font-normal text-neutral-charcoal underline decoration-dotted underline-offset-2 outline-hidden">
        {relative}
      </Button>
      <Tooltip>{format.dateTime(lastSignInAt, DATE_TIME_UTC_FORMAT)}</Tooltip>
    </TooltipTrigger>
  );
};

const UserActionsCell = ({ user }: { user: User }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddToOrgModalOpen, setIsAddToOrgModalOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <OptionMenu
        aria-label={t('User options')}
        variant="outline"
        size="medium"
      >
        <DropdownMenuItem
          onClick={() => {
            window.open(getAnalyticsUserUrl(user.authUserId), '_blank');
          }}
        >
          {t('View analytics')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (user.profile) {
              setIsEditModalOpen(true);
            }
          }}
          disabled={!user.profile}
        >
          {t('Edit profile')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsAddToOrgModalOpen(true)}>
          Add to Organization
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
      </OptionMenu>
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
    </div>
  );
};

const UsersTableSkeleton = () => {
  return (
    <Table aria-label="Loading users">
      <TableHeader>
        <TableRow>
          {[...Array(7)].map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-14" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(7)].map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
