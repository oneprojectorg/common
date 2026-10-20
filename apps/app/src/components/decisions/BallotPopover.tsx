'use client';

import type { Proposal } from '@op/common/client';
import { BadgeNumber } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@op/sense/Popover';
import {
  DragHandle,
  Sortable,
  type SortableItemControls,
} from '@op/sense/Sortable';
import type { ReactNode } from 'react';
import { LuChevronDown, LuChevronUp, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  type BallotBudget,
  formatBallotAmount,
  getBallotRemaining,
  getBallotTotal,
  getProposalCost,
  moveBallotItem,
} from './ballot';
import { resolvePresentationFields } from './selection/proposalPresentation';

/**
 * The ranked ballot behind the footer bar's selection count: the picks in
 * order of preference, to reorder or remove.
 */
export const BallotPopover = ({
  ballot,
  budget,
  onBallotChange,
  children,
}: {
  ballot: Proposal[];
  budget?: BallotBudget;
  onBallotChange: (ballot: Proposal[]) => void;
  /** The trigger's label: the selection count. */
  children: ReactNode;
}) => {
  const t = useTranslations('decisions.proposals');

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" className="text-base font-normal" />}
      >
        {children}
        <LuChevronUp data-icon="inline-end" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="sm:w-96">
        <PopoverHeader>
          <PopoverTitle>{t('ballotTitle')}</PopoverTitle>
          <PopoverDescription>{t('ballotReorderHint')}</PopoverDescription>
        </PopoverHeader>

        {ballot.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('ballotEmptyHint')}
          </p>
        ) : (
          <Sortable
            items={ballot}
            onChange={onBallotChange}
            aria-label={t('ballotTitle')}
            className="max-h-80 gap-1 overflow-y-auto"
          >
            {(proposal, controls) => (
              <BallotRow
                proposal={proposal}
                ballot={ballot}
                budget={budget}
                controls={controls}
                onBallotChange={onBallotChange}
              />
            )}
          </Sortable>
        )}

        {budget && <BallotRemaining ballot={ballot} budget={budget} />}
      </PopoverContent>
    </Popover>
  );
};

const BallotRow = ({
  proposal,
  ballot,
  budget,
  controls,
  onBallotChange,
}: {
  proposal: Proposal;
  ballot: Proposal[];
  budget?: BallotBudget;
  controls: SortableItemControls;
  onBallotChange: (ballot: Proposal[]) => void;
}) => {
  const t = useTranslations('decisions.proposals');
  const { title: titleText } = resolvePresentationFields({
    proposal,
    defaultTitle: t('untitledProposal'),
  });
  const { index, dragHandleProps } = controls;
  const rank = index + 1;

  const move = (offset: -1 | 1) =>
    onBallotChange(moveBallotItem({ items: ballot, index, offset }));

  return (
    <div className="flex items-center gap-2 rounded-md bg-background py-1">
      <DragHandle
        {...dragHandleProps}
        aria-label={t('ballotDragLabel', { title: titleText })}
      />
      <BadgeNumber aria-hidden>{rank}</BadgeNumber>
      <p className="min-w-0 flex-1 truncate text-sm">
        <bdi>{titleText}</bdi>
      </p>
      {budget && (
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {formatBallotAmount({
            amount: getProposalCost({ proposal, budget }),
            unit: budget.unit,
          })}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={index === 0}
        onClick={() => move(-1)}
        aria-label={t('ballotMoveUpLabel', { title: titleText })}
      >
        <LuChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={index === ballot.length - 1}
        onClick={() => move(1)}
        aria-label={t('ballotMoveDownLabel', { title: titleText })}
      >
        <LuChevronDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() =>
          onBallotChange(ballot.filter(({ id }) => id !== proposal.id))
        }
        aria-label={t('ballotRemoveLabel', { title: titleText })}
      >
        <LuX />
      </Button>
    </div>
  );
};

const BallotRemaining = ({
  ballot,
  budget,
}: {
  ballot: Proposal[];
  budget: BallotBudget;
}) => {
  const t = useTranslations('decisions.proposals');
  const total = getBallotTotal({ proposals: ballot, budget });
  const remaining = getBallotRemaining({ proposals: ballot, budget });

  return (
    <div className="flex justify-between gap-4 border-t pt-3 text-sm text-muted-foreground tabular-nums">
      <span>
        {t('budgetAllocatedAmount', {
          allocated: formatBallotAmount({ amount: total, unit: budget.unit }),
        })}
      </span>
      <span>
        {t('budgetRemainingAmount', {
          remaining: formatBallotAmount({
            amount: remaining,
            unit: budget.unit,
          }),
        })}
      </span>
    </div>
  );
};
