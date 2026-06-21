'use client';

import { Button } from '@op/ui/Button';
import { ButtonGroup } from '@op/ui/ButtonGroup';
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
 * and the map browse view, built on the shared `ButtonGroup` (selected/unselected
 * colors come from its `aria-pressed` styling).
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
    <ButtonGroup aria-label={t('Proposal view')} className={className}>
      {options.map(({ id, label, Icon }) => (
        <Button
          key={id}
          color="secondary"
          size="small"
          aria-label={label}
          aria-pressed={value === id}
          onPress={() => onChange(id)}
          className="size-8 p-0"
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
    </ButtonGroup>
  );
}
