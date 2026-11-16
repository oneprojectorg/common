'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';

import { useTranslations } from '@/lib/i18n';

/**
 * The admin's overview of the develop phase by category: each category's
 * proposals from the last phase and its entries marked ready, both counted in
 * the API. A category opens the proposals tab filtered to it.
 */
export function DevelopCategoriesTableSuspense({
  processInstanceId,
  onSelectCategory,
}: {
  processInstanceId: string;
  onSelectCategory: (categoryId: string) => void;
}) {
  const t = useTranslations('decisions.develop');
  const [{ items: categories }] =
    trpc.decision.listDevelopCategoryTotals.useSuspenseQuery({
      processInstanceId,
    });

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <Header3>{t('categoriesCount', { count: categories.length })}</Header3>
      </div>
      <Table aria-label={t('categoriesTableLabel')}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t('categoryColumn')}</TableHead>
            <TableHead scope="col">{t('underConsiderationColumn')}</TableHead>
            <TableHead scope="col">{t('advancingColumn')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableRowHeader className="py-4">
                <Button
                  variant="link"
                  size="inline"
                  className="text-foreground"
                  aria-label={t('showCategoryProposalsLabel', {
                    category: category.name,
                  })}
                  onClick={() => onSelectCategory(category.id)}
                >
                  <bdi>{category.name}</bdi>
                </Button>
              </TableRowHeader>
              <TableCell className="py-4 tabular-nums">
                {category.originsTotal}
              </TableCell>
              <TableCell className="py-4 tabular-nums">
                {category.readyEntriesTotal}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DevelopCategoriesTableSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-4 py-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </div>
  );
}
