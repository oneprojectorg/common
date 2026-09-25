'use client';

import type { ProposalFilter } from '@op/api/encoders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalFilterItem } from './proposalFilterQuery';

/**
 * The audience filter as a tab bar above the list.
 *
 * One panel, always the active one, so switching re-renders the list in place
 * rather than remounting it and losing scroll and loaded pages. The cost is
 * that Base UI only registers the mounted panel, so inactive tabs carry no
 * `aria-controls`.
 */
export const ProposalFilterTabs = ({
  items,
  value,
  onValueChange,
  children,
}: {
  items: ProposalFilterItem[];
  /** Always one of `items`. */
  value: ProposalFilter;
  onValueChange: (filter: ProposalFilter) => void;
  children: ReactNode;
}) => {
  const t = useTranslations('decisions.proposals');

  return (
    <Tabs
      className="gap-6"
      value={value}
      // Base UI hands back an untyped value; the lookup is the type guard.
      onValueChange={(next) => {
        const selected = items.find((item) => item.id === next);
        if (selected && !selected.isDisabled) {
          onValueChange(selected.id);
        }
      }}
    >
      {/* Rail on a wrapper: sense's `line` variant draws only the indicator. */}
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
      {/* `relative` so the sticky bar's pin sentinel anchors at the bar, not a
          rail-height above it. */}
      <TabsContent value={value} className="relative flex grow flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
};
