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
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, type RefCallback, useRef } from 'react';
import { LuChevronDown, LuChevronUp, LuCircleCheck, LuX } from 'react-icons/lu';

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
  const popupRef = useRef<HTMLDivElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const getTitle = (proposal: Proposal) =>
    resolvePresentationFields({
      proposal,
      defaultTitle: t('untitledProposal'),
    }).title;

  // Focus moves before the row unmounts, or it drops to the document body.
  const remove = (index: number) => {
    const removed = ballot[index];
    const neighbour = ballot[index + 1] ?? ballot[index - 1];
    const nextFocus = neighbour && removeButtons.current.get(neighbour.id);

    (nextFocus ?? popupRef.current)?.focus();
    onBallotChange(ballot.filter((proposal) => proposal !== removed));
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={cn(
              'text-base',
              ballot.length === 0
                ? 'font-normal text-muted-foreground'
                : 'font-medium',
            )}
          />
        }
      >
        <LuCircleCheck
          data-icon="inline-start"
          aria-hidden
          className={cn(
            'size-5',
            ballot.length === 0 ? 'text-input' : 'text-primary',
          )}
        />
        {children}
        <LuChevronDown
          data-icon="inline-end"
          aria-hidden
          className="text-muted-foreground transition-transform group-data-popup-open/button:rotate-180 motion-reduce:transition-none"
        />
      </PopoverTrigger>
      <PopoverContent
        ref={popupRef}
        side="top"
        align="start"
        className="sm:w-96"
      >
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
            getItemLabel={getTitle}
            className="max-h-80 gap-1 overflow-y-auto"
          >
            {(proposal, controls) => {
              const { index } = controls;
              const move = (offset: -1 | 1) =>
                onBallotChange(
                  moveBallotItem({ items: ballot, index, offset }),
                );

              return (
                <BallotRow
                  proposal={proposal}
                  title={getTitle(proposal)}
                  budget={budget}
                  controls={controls}
                  onMoveUp={index > 0 ? () => move(-1) : undefined}
                  onMoveDown={
                    index < ballot.length - 1 ? () => move(1) : undefined
                  }
                  onRemove={() => remove(index)}
                  removeButtonRef={(node) => {
                    if (!node) {
                      return;
                    }
                    removeButtons.current.set(proposal.id, node);
                    return () => {
                      removeButtons.current.delete(proposal.id);
                    };
                  }}
                />
              );
            }}
          </Sortable>
        )}

        {budget && <BallotRemaining ballot={ballot} budget={budget} />}
      </PopoverContent>
    </Popover>
  );
};

const BallotRow = ({
  proposal,
  title: titleText,
  budget,
  controls,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeButtonRef,
}: {
  proposal: Proposal;
  title: string;
  budget?: BallotBudget;
  controls: SortableItemControls;
  /** Undefined at the top of the ballot. */
  onMoveUp?: () => void;
  /** Undefined at the bottom of the ballot. */
  onMoveDown?: () => void;
  onRemove: () => void;
  removeButtonRef: RefCallback<HTMLButtonElement>;
}) => {
  const t = useTranslations('decisions.proposals');
  const { index, dragHandleProps } = controls;
  const rank = index + 1;

  return (
    <div className="flex items-center gap-2 rounded-md bg-background py-1">
      <DragHandle
        {...dragHandleProps}
        aria-label={t('ballotDragLabel', { title: titleText })}
      />
      <BadgeNumber aria-hidden>{rank}</BadgeNumber>
      <p
        dir="auto"
        className="min-w-0 flex-1 truncate text-sm ltr:text-left rtl:text-right"
      >
        {titleText}
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
        disabled={!onMoveUp}
        // Focusable at the edge, or a move to the top drops keyboard focus.
        focusableWhenDisabled
        className="aria-disabled:opacity-50"
        onClick={onMoveUp}
        aria-label={t('ballotMoveUpLabel', { title: titleText })}
      >
        <LuChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!onMoveDown}
        focusableWhenDisabled
        className="aria-disabled:opacity-50"
        onClick={onMoveDown}
        aria-label={t('ballotMoveDownLabel', { title: titleText })}
      >
        <LuChevronDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        ref={removeButtonRef}
        onClick={onRemove}
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
