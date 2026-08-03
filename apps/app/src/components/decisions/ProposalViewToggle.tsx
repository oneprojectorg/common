'use client';

import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import { LuLayoutGrid, LuMap } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export const PROPOSAL_VIEWS = ['grid', 'map'] as const;
export type ProposalView = (typeof PROPOSAL_VIEWS)[number];

interface ProposalViewToggleProps {
  value: ProposalView;
  onChange: (view: ProposalView) => void;
  className?: string;
}

/**
 * Desktop-only segmented control switching the proposals list between the grid
 * and the map browse view, built on the shared `ToggleGroup` (selected/unselected
 * colors come from its pressed styling). `spacing={0}` joins the items into a
 * single segmented control.
 */
export function ProposalViewToggle({
  value,
  onChange,
  className,
}: ProposalViewToggleProps) {
  const t = useTranslations();

  const options = [
    { id: 'grid', label: t('Grid view'), Icon: LuLayoutGrid },
    { id: 'map', label: t('Map view'), Icon: LuMap },
  ] as const;

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(groupValue) => {
        // Single-select: ignore the empty array from re-pressing the active item
        // so the current view can't be deselected.
        const next = groupValue[0];
        if (next) {
          onChange(next as ProposalView);
        }
      }}
      variant="outline"
      size="icon-sm"
      spacing={0}
      aria-label={t('Proposal view')}
      className={className}
    >
      {options.map(({ id, label, Icon }) => (
        <ToggleGroupItem key={id} value={id} aria-label={label}>
          <Icon className="size-4" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
