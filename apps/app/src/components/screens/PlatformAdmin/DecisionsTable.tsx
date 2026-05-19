'use client';

import { DATE_TIME_UTC_FORMAT } from '@/utils/formatting';
import { trpc } from '@op/api/client';
import type { AdminDecisionInstance } from '@op/common/client';
import { useCursorPagination, useDebounce } from '@op/hooks';
import { type ColumnDef, DataTable } from '@op/ui-next/DataTable';
import { Header2 } from '@op/ui-next/Header';
import { DropdownMenuItem } from '@op/ui-next/Menu';
import { Modal, ModalBody, ModalHeader } from '@op/ui-next/Modal';
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

const STATUS_DISPLAY: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const DecisionsTable = () => {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 200);

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Header2 className="text-md font-serif">{t('All Decisions')}</Header2>
        <div className="w-64">
          <SearchField
            aria-label={t('Search decisions by name')}
            placeholder={t('Search decisions by name')}
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
      </div>
      <Suspense fallback={<DecisionsTableSkeleton />}>
        <DecisionsTableContent searchQuery={debouncedQuery} />
      </Suspense>
    </div>
  );
};

const DecisionsTableContent = ({ searchQuery }: { searchQuery: string }) => {
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

  const [data] = trpc.platform.admin.listAllDecisionInstances.useSuspenseQuery({
    cursor,
    limit,
    query: searchQuery || undefined,
  });

  const { items: decisions, next, total } = data;

  const onNext = () => {
    if (next) {
      handleNext(next);
    }
  };

  const columns = useMemo<ColumnDef<AdminDecisionInstance, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('Name'),
        cell: ({ row }) => row.original.name,
      },
      {
        id: 'currentPhase',
        header: t('Current Phase'),
        cell: ({ row }) => {
          const phase = row.original.currentPhase;
          if (!phase) {
            return <span className="text-neutral-charcoal">—</span>;
          }
          const phaseEndDate = phase.endDate ? new Date(phase.endDate) : null;
          return (
            <div className="flex flex-col text-neutral-charcoal">
              <span>{phase.name ?? phase.id}</span>
              {phaseEndDate ? (
                <span className="text-xs text-neutral-gray4">
                  {t('Ends {date}', {
                    date: format.dateTime(phaseEndDate, {
                      dateStyle: 'medium',
                    }),
                  })}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'steward',
        header: t('Steward'),
        cell: ({ row }) => (
          <span className="text-neutral-charcoal">
            {row.original.stewardName ?? '—'}
          </span>
        ),
      },
      {
        id: 'proposals',
        header: t('Proposals'),
        cell: ({ row }) => {
          const { proposalCount, totalProposalCount } = row.original;
          if (totalProposalCount > proposalCount) {
            return (
              <span className="text-neutral-charcoal">
                <TooltipTrigger>
                  <Button className="underline decoration-dotted underline-offset-2 outline-hidden">
                    {proposalCount} ({totalProposalCount})
                  </Button>
                  <Tooltip>
                    {t(
                      '{nonDraft} non-draft proposals, {total} total including drafts',
                      {
                        nonDraft: proposalCount,
                        total: totalProposalCount,
                      },
                    )}
                  </Tooltip>
                </TooltipTrigger>
              </span>
            );
          }
          return <span className="text-neutral-charcoal">{proposalCount}</span>;
        },
      },
      {
        id: 'participants',
        header: t('Participants'),
        cell: ({ row }) => (
          <span className="text-neutral-charcoal">
            {row.original.participantCount}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('Status'),
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span className="text-neutral-charcoal">
              {status ? (STATUS_DISPLAY[status] ?? status) : '—'}
            </span>
          );
        },
      },
      {
        id: 'created',
        header: t('Created'),
        cell: ({ row }) => {
          const createdAt = row.original.createdAt
            ? new Date(row.original.createdAt)
            : null;
          if (!createdAt) {
            return <span className="text-neutral-charcoal">—</span>;
          }
          return (
            <span className="text-neutral-charcoal">
              <TooltipTrigger>
                <Button className="underline decoration-dotted underline-offset-2 outline-hidden">
                  {format.dateTime(createdAt, { dateStyle: 'medium' })}
                </Button>
                <Tooltip>
                  {format.dateTime(createdAt, DATE_TIME_UTC_FORMAT)}
                </Tooltip>
              </TooltipTrigger>
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="block text-right">{t('Actions')}</span>,
        cell: ({ row }) => <DecisionActionsCell decision={row.original} />,
      },
    ],
    [t, format],
  );

  return (
    <>
      <DataTable
        aria-label={t('All Decisions')}
        columns={columns}
        data={decisions}
        getRowId={(decision) => decision.id}
      />
      <div className="mt-4">
        <Pagination
          range={{
            totalItems: total,
            itemsPerPage: limit,
            page: currentPage,
            label: t('decisions'),
          }}
          next={next ? onNext : undefined}
          previous={canGoPrevious ? handlePrevious : undefined}
        />
      </div>
    </>
  );
};

const DecisionActionsCell = ({
  decision,
}: {
  decision: AdminDecisionInstance;
}) => {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex justify-end">
      <OptionMenu
        aria-label={t('Decision options')}
        variant="outline"
        size="medium"
      >
        <DropdownMenuItem onClick={() => setIsOpen(true)}>
          {t('View instance data')}
        </DropdownMenuItem>
      </OptionMenu>
      <InstanceDataModal
        name={decision.name}
        instanceData={decision.instanceData}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </div>
  );
};

const InstanceDataModal = ({
  name,
  instanceData,
  isOpen,
  onOpenChange,
}: {
  name: string;
  instanceData: unknown;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) => {
  const t = useTranslations();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Instance data for {name}', { name })}</ModalHeader>
      <ModalBody className="pb-6">
        <pre className="bg-neutral-gray0 max-h-[60vh] overflow-auto rounded-lg p-4 text-xs">
          {JSON.stringify(instanceData, null, 2)}
        </pre>
      </ModalBody>
    </Modal>
  );
};

const DecisionsTableSkeleton = () => {
  const t = useTranslations();
  const headers = [
    t('Name'),
    t('Current Phase'),
    t('Steward'),
    t('Proposals'),
    t('Participants'),
    t('Status'),
    t('Created'),
    t('Actions'),
  ];

  return (
    <Table aria-label="Loading decisions">
      <TableHeader>
        <TableRow>
          {headers.map((h, i) => (
            <TableHead key={i} className={i === 7 ? 'text-right' : undefined}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(8)].map((_, j) => (
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
