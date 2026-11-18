'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { CategoryWithReviewerStatusSchema } from '@op/common/client';
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

import {
  ConfirmCategoryAction,
  UnconfirmCategoryAction,
} from './DevelopAdminCategoryActions';
import {
  countConfirmedReviewers,
  isCategoryConfirmed,
} from './developCategoryStatus';

export function DevelopAdminCategoriesPanel({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex min-h-11 items-center">
        <APIErrorBoundary fallbacks={{ default: () => null }}>
          <Suspense fallback={<Skeleton aria-hidden className="h-7 w-40" />}>
            <CategoriesCountSuspense processInstanceId={processInstanceId} />
          </Suspense>
        </APIErrorBoundary>
      </div>

      <APIErrorBoundary fallbacks={{ default: () => <CategoriesLoadError /> }}>
        <Suspense fallback={<CategoriesTableSkeleton />}>
          <CategoriesTableSuspense processInstanceId={processInstanceId} />
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
}: {
  processInstanceId: string;
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
            processInstanceId={processInstanceId}
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
          <TableHead scope="col">{t('facilitatorsColumn')}</TableHead>
          <TableHead scope="col" className="w-48">
            {t('statusColumn')}
          </TableHead>
          <TableHead scope="col" className="w-56 text-end">
            {t('actionsColumn')}
          </TableHead>
        </TableRow>
      </TableHeader>
      {children}
    </Table>
  );
}

function CategoryRow({
  status,
  processInstanceId,
}: {
  status: CategoryWithReviewerStatusSchema;
  processInstanceId: string;
}) {
  const t = useTranslations('decisions.develop');
  const format = useFormatter();
  const { category, reviewers } = status;
  const confirmedCount = countConfirmedReviewers(reviewers);
  const hasFacilitators = reviewers.length > 0;
  const isConfirmed = isCategoryConfirmed(status);

  return (
    <TableRow>
      <TableRowHeader className="py-4 whitespace-normal">
        <bdi>{category.name}</bdi>
      </TableRowHeader>
      <TableCell className="py-4 whitespace-normal">
        {hasFacilitators ? (
          format.list(
            reviewers.map((reviewer) => (
              <bdi key={reviewer.reviewerProfileId}>
                {reviewer.profile.name}
              </bdi>
            )),
            { type: 'conjunction' },
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-4">
        {!hasFacilitators ? (
          <span className="text-muted-foreground">
            {t('noFacilitatorStatus')}
          </span>
        ) : isConfirmed ? (
          <StatusBadge variant="success" icon={false}>
            {t('categoryConfirmedStatus')}
          </StatusBadge>
        ) : (
          <StatusBadge variant="in-progress" icon={false}>
            {t('categoryConfirmProgressStatus', {
              confirmed: confirmedCount,
              total: reviewers.length,
            })}
          </StatusBadge>
        )}
      </TableCell>
      <TableCell className="py-4 text-end">
        <div aria-live="polite">
          {!hasFacilitators ? null : isConfirmed ? (
            <UnconfirmCategoryAction
              processInstanceId={processInstanceId}
              category={category}
            />
          ) : (
            <ConfirmCategoryAction
              processInstanceId={processInstanceId}
              category={category}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
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
                <Skeleton className="h-5 w-48" />
              </TableCell>
              <TableCell className="py-4">
                <Skeleton className="h-9 w-32" />
              </TableCell>
              <TableCell className="py-4">
                <Skeleton className="ms-auto h-8 w-36" />
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
