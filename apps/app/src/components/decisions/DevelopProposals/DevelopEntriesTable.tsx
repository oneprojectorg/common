'use client';

import { ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@op/sense/Empty';
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

import { ButtonLink } from '@/components/ButtonLink';

/**
 * The current phase's entries on the develop screen: title, whether the entry
 * is still a draft, and a link into the proposal editor.
 */
export function DevelopEntriesTable({
  entries,
  editHref,
}: {
  entries: Proposal[];
  /** The proposal editor route for an entry. */
  editHref: (entry: Proposal) => string;
}) {
  const t = useTranslations('decisions.develop');

  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle render={<h4 />}>{t('noEntriesTitle')}</EmptyTitle>
          <EmptyDescription>{t('noEntriesDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table aria-label={t('entriesTableLabel')}>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t('entryColumn')}</TableHead>
          <TableHead scope="col">{t('statusColumn')}</TableHead>
          <TableHead scope="col" className="w-32">
            <span className="sr-only">{t('actionsColumn')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const title = entry.profile.name || t('untitledEntry');
          const isDraft = entry.status === ProposalStatus.DRAFT;

          return (
            <TableRow key={entry.id}>
              <TableRowHeader>
                <span
                  dir="auto"
                  className="line-clamp-1 text-base text-foreground ltr:text-left rtl:text-right"
                >
                  {title}
                </span>
              </TableRowHeader>
              <TableCell>
                <Badge variant={isDraft ? 'secondary' : 'success'}>
                  {isDraft ? t('entryDraftStatus') : t('entrySubmittedStatus')}
                </Badge>
              </TableCell>
              <TableCell>
                <ButtonLink
                  href={editHref(entry)}
                  variant="outline"
                  size="sm"
                  className="w-28"
                  aria-label={t('openEntryLabel', { title })}
                >
                  {t('openEntryAction')}
                </ButtonLink>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
