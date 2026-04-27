'use client';

import { trpc } from '@op/api/client';
import type { RubricTemplateSchema } from '@op/common/client';
import { getRubricScoringInfo } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header3 } from '@op/ui/Header';
import { useMemo, useState } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '@/components/Bullet';

import {
  SelectWinnersTable,
  SelectWinnersTableSkeleton,
} from './SelectWinnersTable';

export function SelectWinnersList({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations();

  // Selected proposals — kept client-side until "Confirm decisions" lands in
  // a follow-up PR. Stored as a Set so toggling is O(1) regardless of list size.
  const [advancing, setAdvancing] = useState<Set<string>>(() => new Set());

  const [[instance, data]] = trpc.useSuspenseQueries((t) => [
    t.decision.getInstance({ instanceId: processInstanceId }),
    t.decision.listWithReviewAggregates({
      processInstanceId,
      limit: 100,
    }),
  ]);

  const items = data.items;
  const total = data.total;

  const rubricTemplate = (instance.instanceData?.rubricTemplate ??
    null) as RubricTemplateSchema | null;
  const totalPoints = useMemo(
    () =>
      rubricTemplate ? getRubricScoringInfo(rubricTemplate).totalPoints : 0,
    [rubricTemplate],
  );

  const handleAdvanceToggle = (proposalId: string) => {
    setAdvancing((prev) => {
      const next = new Set(prev);
      if (next.has(proposalId)) {
        next.delete(proposalId);
      } else {
        next.add(proposalId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-serif text-title-base text-neutral-black">
            {t('All proposals')}
          </span>
          <Bullet />
          <span className="font-serif text-title-base text-neutral-black">
            {total}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<LuLeaf className="size-6" />}>
          <Header3 className="font-serif !text-title-base font-light text-neutral-black">
            {t('No proposals to review yet')}
          </Header3>
          <p className="text-base text-neutral-charcoal">
            {t('Proposals will appear here once they are submitted.')}
          </p>
        </EmptyState>
      ) : (
        <SelectWinnersTable
          items={items}
          totalPoints={totalPoints}
          onAdvance={handleAdvanceToggle}
          advancingIds={advancing}
        />
      )}

      <ConfirmFooter advancingCount={advancing.size} />
    </div>
  );
}

export function SelectWinnersListSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="h-8 w-32 animate-pulse rounded bg-neutral-gray1" />
      <SelectWinnersTableSkeleton />
    </div>
  );
}

function ConfirmFooter({ advancingCount }: { advancingCount: number }) {
  const t = useTranslations();

  return (
    <div className="fixed right-0 bottom-0 left-0 z-10 flex w-full items-center justify-between border-t border-neutral-gray1 bg-neutral-offWhite/95 px-4 py-2 backdrop-blur sm:px-44">
      <span className="text-sm text-neutral-black">
        {t('{count} proposals advancing', { count: advancingCount })}
      </span>
      <Button
        size="medium"
        color="primary"
        isDisabled={advancingCount === 0}
        onPress={() => {
          // Mutation lands in a follow-up PR — confirm-decisions API.
        }}
      >
        {t('Confirm decisions')}
      </Button>
    </div>
  );
}
