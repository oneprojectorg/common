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
              // Pulled out by its own padding so the icon lines up with the bar.
              '-ms-4 text-base data-popup-open:bg-secondary max-md:text-sm',
              ballot.length === 0
                ? 'font-normal text-muted-foreground'
                : 'font-medium',
            )}
          />
        }
      >
        <LuCircleCheck
          aria-hidden
          className={cn('size-5', ballot.length === 0 && 'text-input')}
        />
        {children}
      </PopoverTrigger>
      <PopoverContent
        ref={popupRef}
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        className="max-h-(--available-height) w-156 max-w-(--available-width) gap-0 overflow-hidden p-0"
      >
        <PopoverHeader className="px-4 pt-4 pb-3">
          <PopoverTitle className="text-title">{t('ballotTitle')}</PopoverTitle>
          <PopoverDescription className="text-base">
            {t('ballotReorderHint')}
          </PopoverDescription>
        </PopoverHeader>

        {ballot.length === 0 ? (
          <p className="px-4 pb-4 text-base text-muted-foreground">
            {t('ballotEmptyHint')}
          </p>
        ) : (
          <Sortable
            items={ballot}
            onChange={onBallotChange}
            aria-label={t('ballotTitle')}
            getItemLabel={getTitle}
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
            itemClassName="not-first:border-t"
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
    <div className="flex items-center gap-2 bg-background py-2.5">
      <DragHandle
        {...dragHandleProps}
        className="ms-1 me-3"
        aria-label={t('ballotDragLabel', { title: titleText })}
      />
      <BadgeNumber variant="secondary" aria-hidden>
        {rank}
      </BadgeNumber>
      <p className="min-w-0 flex-1 text-base">
        <bdi>{titleText}</bdi>
      </p>
      {budget && (
        <span className="shrink-0 text-base text-muted-foreground tabular-nums">
          {formatBallotAmount({
            amount: getProposalCost({ proposal, budget }),
            unit: budget.unit,
          })}
        </span>
      )}
      <div className="ms-2.5 flex shrink-0 gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!onMoveUp}
          // Focusable at the edge, or a move to the top drops keyboard focus.
          focusableWhenDisabled
          className="aria-disabled:opacity-30"
          onClick={onMoveUp}
          aria-label={t('ballotMoveUpLabel', { title: titleText })}
        >
          <LuChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!onMoveDown}
          focusableWhenDisabled
          className="aria-disabled:opacity-30"
          onClick={onMoveDown}
          aria-label={t('ballotMoveDownLabel', { title: titleText })}
        >
          <LuChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          ref={removeButtonRef}
          onClick={onRemove}
          className="hover:bg-destructive-muted hover:text-destructive"
          aria-label={t('ballotRemoveLabel', { title: titleText })}
        >
          <LuX />
        </Button>
      </div>
    </div>
  );
};
