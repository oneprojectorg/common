'use client';

import type { ProposalFilter } from '@op/api/encoders';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { ProposalFilterItem } from './proposalFilterQuery';

// One panel, always the active one, so switching re-renders the list in place
// instead of remounting it. Base UI only registers the mounted panel, so
// inactive tabs carry no `aria-controls`.
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
      // Base UI hands back an untyped value; the lookup is the type guard.
      onValueChange={(next) => {
        const selected = items.find((item) => item.id === next);
        if (selected && !selected.isDisabled) {
          onValueChange(selected.id);
        }
      }}
    >
      {/* On a wrapper: sense's `line` variant draws only the indicator. */}
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
          tab-bar height above it. */}
      <TabsContent value={value} className="relative flex grow flex-col gap-6">
        {children}
      </TabsContent>
    </Tabs>
  );
};
