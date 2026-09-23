'use client';

import type { ProposalFilter } from '@op/api/encoders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useProposalFilterItems } from './useProposalFilterItems';

/**
 * The proposal-filter dimension as a tab bar above the list, mirroring
 * `DecisionResultsTabs`. It replaces the filter select rather than sitting
 * beside it: two controls writing one piece of state is how they drift.
 *
 * The list renders inside the panel, so this is a real tablist with somewhere
 * to point, not a row of buttons wearing tab roles. One panel, always the
 * active one — switching filters re-renders the list in place instead of
 * remounting it, which is what keeps scroll position and the loaded pages.
 * The trade that buys: Base UI registers panel ids by value, so only the
 * selected tab carries `aria-controls`. The selected tab is the one a screen
 * reader jumps from, and the panel's `aria-labelledby` is always right, so the
 * wiring holds where it is used — a panel per filter would be correct on paper
 * and would remount the list on every switch.
 */
export const ProposalFilterTabs = ({
  hasVoted,
  currentProfileId,
  value,
  onValueChange,
  children,
}: {
  hasVoted: boolean;
  currentProfileId: string | undefined;
  value: ProposalFilter;
  onValueChange: (filter: ProposalFilter) => void;
  children: ReactNode;
}) => {
  const t = useTranslations('decisions.proposals');
  // Read here rather than handed down: both controls call the same hook at the
  // point they render, so neither can be given a list the other doesn't have.
  const items = useProposalFilterItems({ hasVoted, currentProfileId });

  return (
    <Tabs
      className="gap-6"
      value={value}
      // Base UI hands back an untyped tab value; resolving it against the item
      // list is the type guard, and it re-asserts the disabled rule on the way
      // through rather than trusting the trigger to be the only gate.
      onValueChange={(next) => {
        const selected = items.find((item) => item.id === next);
        if (selected && !selected.isDisabled) {
          onValueChange(selected.id);
        }
      }}
    >
      {/* The rail lives on a wrapper, not the list — sense's `line` variant
          draws the active indicator only. Mirrors DecisionResultsTabs. */}
      <div className="w-full overflow-x-auto border-b">
        <TabsList
          variant="line"
          className="flex gap-6"
          aria-label={t('filterProposalsLabel')}
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              disabled={item.isDisabled}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {/* `relative` so the sticky filter bar's pin sentinel anchors here rather
          than at the top of the list container: the rail sits above the panel,
          and from the container the sentinel crossed the pin line a rail-height
          early, fading the bar's hairline in mid-scroll. */}
      <TabsContent value={value} className="relative flex grow flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
};
