'use client';

import type { Proposal } from '@op/common/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@op/sense/Table';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

/**
 * The origins without review aggregates, for a caller who cannot read the
 * previous phase's reviews: name and submitter, then the row's action.
 */
export function DevelopOriginsTable({
  origins,
  renderAction,
}: {
  origins: Proposal[];
  renderAction: (origin: Proposal) => ReactNode;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <Table aria-label={t('originsTableLabel')}>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('nameColumn')}</TableHead>
          <TableHead scope="col">
            <span className="sr-only">{t('actionsColumn')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {origins.map((origin) => {
          const submitterName = origin.submittedBy?.name ?? null;

          return (
            <TableRow key={origin.id}>
              <TableRowHeader>
                <div className="flex flex-col items-start gap-1">
                  <span
                    dir="auto"
                    className="line-clamp-1 text-base text-foreground ltr:text-left rtl:text-right"
                  >
                    {origin.profile.name || t('untitledProposal')}
                  </span>
                  {submitterName ? (
                    <span
                      dir="auto"
                      className="line-clamp-1 text-sm text-muted-foreground ltr:text-left rtl:text-right"
                    >
                      {submitterName}
                    </span>
                  ) : null}
                </div>
              </TableRowHeader>
              <TableCell>{renderAction(origin)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
