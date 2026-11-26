'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { CategoryWithReviewerStatusSchema } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@op/sense/Empty';
import { Header2 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import { useFormatter } from 'next-intl';
import { type ReactNode, Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { getCategoryConfirmedAt } from './developCategoryStatus';

/** Each category's row opens that category's page through `onOpenCategory`. */
export function DevelopAdminCategoriesPanel({
  processInstanceId,
  onOpenCategory,
}: {
  processInstanceId: string;
  onOpenCategory: (categoryId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex min-h-11 items-center">
        {/* Outside Suspense so the live region exists before the count changes. */}
        <div role="status" aria-live="polite">
          <APIErrorBoundary fallbacks={{ default: () => null }}>
            <Suspense fallback={<Skeleton aria-hidden className="h-7 w-40" />}>
              <CategoriesCountSuspense processInstanceId={processInstanceId} />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </div>

      <APIErrorBoundary fallbacks={{ default: () => <CategoriesLoadError /> }}>
        <Suspense fallback={<CategoriesTableSkeleton />}>
          <CategoriesTableSuspense
            processInstanceId={processInstanceId}
            onOpenCategory={onOpenCategory}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function CategoriesCountSuspense({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations('decisions.develop');
  const [{ items }] = trpc.decision.listCategoryReviewerStatus.useSuspenseQuery(
    {
      processInstanceId,
    },
  );

  return (
    <Header2 className="text-title font-normal">
      {t('categoriesCount', { count: items.length })}
    </Header2>
  );
}

function CategoriesTableSuspense({
  processInstanceId,
  onOpenCategory,
}: {
  processInstanceId: string;
  onOpenCategory: (categoryId: string) => void;
}) {
  const [{ items }] = trpc.decision.listCategoryReviewerStatus.useSuspenseQuery(
    {
      processInstanceId,
    },
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <CategoriesTable>
      <TableBody>
        {items.map((status) => (
          <CategoryRow
            key={status.category.id}
            status={status}
            onOpen={() => onOpenCategory(status.category.id)}
          />
        ))}
      </TableBody>
    </CategoriesTable>
  );
}

function CategoriesTable({ children }: { children: ReactNode }) {
  const t = useTranslations('decisions.develop');

  return (
    <Table
      aria-label={t('categoriesTableLabel')}
      className="min-w-3xl table-fixed [&_tr>*:first-child]:ps-0 [&_tr>*:last-child]:pe-0"
    >
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('categoryColumn')}</TableHead>
          <TableHead scope="col" className="w-48">
            {t('underConsiderationColumn')}
          </TableHead>
          <TableHead scope="col" className="w-48">
            {t('advancingColumn')}
          </TableHead>
          <TableHead scope="col" className="w-48">
            {t('statusColumn')}
          </TableHead>
        </TableRow>
      </TableHeader>
      {children}
    </Table>
  );
}

function CategoryRow({
  status,
  onOpen,
}: {
  status: CategoryWithReviewerStatusSchema;
  onOpen: () => void;
}) {
  const t = useTranslations('decisions.develop');
  const { category, sourceCount, advancingCount } = status;
  const isConfirmed = getCategoryConfirmedAt(status) !== null;

  return (
    <TableRow>
      <TableRowHeader className="py-4 whitespace-normal">
        <Button
          variant="link"
          size="inline"
          onClick={onOpen}
          className="justify-start text-start whitespace-normal text-foreground"
        >
          <bdi>{category.name}</bdi>
        </Button>
      </TableRowHeader>
      <TableCell className="py-4 tabular-nums">{sourceCount}</TableCell>
      <TableCell className="py-4 tabular-nums">
        {isConfirmed ? (
          advancingCount
        ) : (
          <span className="text-muted-foreground">
            {t('advancingSoFar', { count: advancingCount })}
          </span>
        )}
      </TableCell>
      <TableCell className="py-4">
        <div aria-live="polite">
          <CategoryStatus status={status} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function CategoryStatus({
  status,
}: {
  status: CategoryWithReviewerStatusSchema;
}) {
  const t = useTranslations('decisions.develop');
  const format = useFormatter();
  const confirmedAt = getCategoryConfirmedAt(status);

  if (status.reviewers.length === 0) {
    return (
      <span className="text-muted-foreground">
        {t('categoryUnassignedStatus')}
      </span>
    );
  }

  if (confirmedAt === null) {
    return (
      <StatusBadge variant="in-progress" icon={false}>
        {t('categoryDeliberatingStatus')}
      </StatusBadge>
    );
  }

  return (
    <StatusBadge variant="success" icon={false}>
      {t('categoryConfirmedStatus', {
        date: format.dateTime(new Date(confirmedAt), {
          month: 'short',
          day: 'numeric',
        }),
      })}
    </StatusBadge>
  );
}

function CategoriesTableSkeleton() {
  return (
    <div aria-hidden>
      <CategoriesTable>
        <TableBody>
          {Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell className="py-4">
                <Skeleton className="h-5 w-32" />
              </TableCell>
              <TableCell className="py-4">
                <Skeleton className="h-5 w-12" />
              </TableCell>
              <TableCell className="py-4">
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="py-4">
                <Skeleton className="h-9 w-32" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </CategoriesTable>
    </div>
  );
}

function CategoriesLoadError() {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('categoriesLoadError')}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
