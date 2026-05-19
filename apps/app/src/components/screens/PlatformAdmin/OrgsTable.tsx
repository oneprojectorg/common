'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import type { AdminOrg } from '@op/api/encoders';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { type ColumnDef, DataTable } from '@op/ui-next/DataTable';
import { Header2 } from '@op/ui-next/Header';
import { DropdownMenuItem } from '@op/ui-next/Menu';
import { OptionMenu } from '@op/ui-next/OptionMenu';
import { Pagination } from '@op/ui-next/Pagination';
import { SearchField } from '@op/ui-next/SearchField';
import { Skeleton } from '@op/ui-next/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@op/ui-next/Table';
import { Tooltip, TooltipTrigger } from '@op/ui-next/Tooltip';
import { useFormatter } from 'next-intl';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { OrgMembersModal } from './OrgMembersModal';

export const OrgsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-md font-serif">
          {t('All Organizations')}
        </Header2>
        <div className="w-64">
          <SearchField
            aria-label={t('Search organizations by name')}
            placeholder={t('Search organizations by name')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
      </div>
      <Suspense fallback={<OrgsTableSkeleton />}>
        <OrgsTableContent searchQuery={debouncedQuery} />
      </Suspense>
    </div>
  );
};

const OrgsTableContent = ({ searchQuery }: { searchQuery: string }) => {
  const t = useTranslations();
  const format = useFormatter();
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

  const [data] = trpc.platform.admin.listAllOrganizations.useSuspenseQuery({
    cursor,
    limit,
    query: searchQuery || undefined,
  });

  const { items: orgs, next, total } = data;

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  const columns = useMemo<ColumnDef<AdminOrg, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('Name'),
        cell: ({ row }) => (
          <span className="text-sm font-normal text-neutral-black">
            {row.original.profile?.name ?? '—'}
          </span>
        ),
      },
      {
        id: 'domain',
        header: t('Domain'),
        cell: ({ row }) => (
          <span className="text-sm font-normal text-neutral-charcoal">
            {row.original.domain ?? '—'}
          </span>
        ),
      },
      {
        id: 'members',
        header: t('Members'),
        cell: ({ row }) => (
          <span className="text-sm font-normal text-neutral-charcoal">
            {row.original.members?.length ?? 0}
          </span>
        ),
      },
      {
        id: 'created',
        header: t('Created'),
        cell: ({ row }) => {
          const createdAt = row.original.createdAt
            ? new Date(row.original.createdAt)
            : null;
          if (!createdAt) {
            return (
              <span className="text-sm font-normal text-neutral-charcoal">
                —
              </span>
            );
          }
          return (
            <TooltipTrigger>
              <Button className="cursor-default text-sm font-normal text-neutral-charcoal underline decoration-dotted underline-offset-2 outline-hidden">
                {format.dateTime(createdAt, { dateStyle: 'medium' })}
              </Button>
              <Tooltip>
                {format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
              </Tooltip>
            </TooltipTrigger>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="block text-right">{t('Actions')}</span>,
        cell: ({ row }) => <OrgActionsCell org={row.original} />,
      },
    ],
    [t, format],
  );

  return (
    <>
      <DataTable
        aria-label={t('All Organizations')}
        columns={columns}
        data={orgs}
        getRowId={(org) => org.id}
      />
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('organizations'),
          }}
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

const OrgActionsCell = ({ org }: { org: AdminOrg }) => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <OptionMenu
        aria-label={t('Organization options')}
        variant="outline"
        size="medium"
      >
        <DropdownMenuItem onClick={() => setIsOpen(true)}>
          {t('View members')}
        </DropdownMenuItem>
      </OptionMenu>
      <OrgMembersModal org={org} isOpen={isOpen} onOpenChange={setIsOpen} />
    </div>
  );
};

const OrgsTableSkeleton = () => {
  return (
    <Table aria-label="Loading organizations">
      <TableHeader>
        <TableRow>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-14" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-14" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-14" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(5)].map((_, j) => (
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
