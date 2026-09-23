'use client';

import type { ProposalFilter } from '@op/api/encoders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalFilterItem } from './useProposalFilterItems';

/**
 * The proposal-filter dimension as a tab bar above the list, mirroring
 * `DecisionResultsTabs`. It replaces the filter select rather than sitting
 * beside it: two controls writing one piece of state is how they drift.
 *
 * The list renders inside the panel, so this is a real tablist with somewhere
 * to point, not a row of buttons wearing tab roles. One panel, always the
 * active one — switching filters re-renders the list in place instead of
 * remounting it, which is what keeps scroll position and the loaded pages.
 */
export const ProposalFilterTabs = ({
  items,
  value,
  onValueChange,
  children,
}: {
  items: ProposalFilterItem[];
  value: ProposalFilter;
  onValueChange: (filter: ProposalFilter) => void;
  children: ReactNode;
}) => {
  const t = useTranslations('decisions.proposals');

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
      <TabsContent value={value} className="flex grow flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
};
