'use client';

import { ProposalReviewAssignmentStatus } from '@op/common/client';
import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useTranslations } from '@/lib/i18n';

import { ResponsiveSelect } from '../ResponsiveSelect';

const ASSIGNMENT_STATUSES = Object.values(ProposalReviewAssignmentStatus) as [
  string,
  ...string[],
];

export function useStatusFilter() {
  return useQueryState('status', parseAsStringLiteral(ASSIGNMENT_STATUSES));
}

export function StatusFilterSelect() {
  const t = useTranslations();
  const [statusFilter, setStatusFilter] = useStatusFilter();

  return (
    <ResponsiveSelect
      selectedKey={statusFilter ?? 'all'}
      onSelectionChange={(key) => setStatusFilter(key === 'all' ? null : key)}
      aria-label={t('Filter by status')}
      items={[
        { id: 'all', label: t('All statuses') },
        { id: 'pending', label: t('Not Started') },
        { id: 'in_progress', label: t('In Progress') },
        { id: 'completed', label: t('Completed') },
        {
          id: 'awaiting_author_revision',
          label: t('Revision Requested'),
        },
        { id: 'ready_for_re_review', label: t('Needs Review') },
      ]}
    />
  );
}
