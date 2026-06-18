'use client';

import { IconButton } from '@op/ui/IconButton';
import { cn } from '@op/ui/utils';
import { LuLayoutGrid, LuMap } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export type ProposalView = 'grid' | 'map';

interface ProposalViewToggleProps {
  value: ProposalView;
  onChange: (view: ProposalView) => void;
  className?: string;
}

/**
 * Desktop-only segmented control switching the proposals list between the grid
 * and the map browse view. (The Figma toggle has a third "list" option that we
 * intentionally omit — only grid and map are offered.)
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
    <div
      role="group"
      aria-label={t('Proposal view')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-neutral-gray2 p-0.5',
        className,
      )}
    >
      {options.map(({ id, label, Icon }) => {
        const isSelected = value === id;
        return (
          <IconButton
            key={id}
            size="medium"
            variant={isSelected ? 'solid' : 'ghost'}
            aria-label={label}
            aria-pressed={isSelected}
            onPress={() => onChange(id)}
            className={cn(!isSelected && 'bg-transparent text-neutral-gray4')}
          >
            <Icon className="size-4" aria-hidden />
          </IconButton>
        );
      })}
    </div>
  );
}
