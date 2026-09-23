'use client';

import { ToggleGroup, ToggleGroupItem } from '@op/sense/ToggleGroup';
import type { IconType } from 'react-icons';
import { LuGalleryVertical, LuLayoutGrid, LuMap } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalView } from './proposalViews';

interface ProposalViewToggleProps {
  value: ProposalView;
  /** The views to offer, in display order — see `useProposalViewMode`. */
  views: readonly ProposalView[];
  onChange: (view: ProposalView) => void;
  className?: string;
}

const VIEW_ICONS: Record<ProposalView, IconType> = {
  grid: LuLayoutGrid,
  feed: LuGalleryVertical,
  map: LuMap,
};

const VIEW_LABEL_KEYS = {
  grid: 'gridViewOption',
  feed: 'feedViewOption',
  map: 'mapViewOption',
} as const satisfies Record<ProposalView, string>;

/**
 * Desktop-only segmented control switching a proposals list between its browse
 * views, built on the shared `ToggleGroup` (selected/unselected colors come
 * from its pressed styling). `spacing={0}` joins the items into a single
 * segmented control.
 *
 * The caller passes the views it can actually render, so an option can never
 * appear on a surface that would fall back to something else when it's picked.
 */
export function ProposalViewToggle({
  value,
  views,
  onChange,
  className,
}: ProposalViewToggleProps) {
  const t = useTranslations('decisions.proposals');

  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(groupValue) => {
        // Single-select: matching against the offered views both narrows the
        // untyped group value and ignores the empty array from re-pressing the
        // active item, so the current view can't be deselected.
        const next = views.find((view) => view === groupValue[0]);
        if (next) {
          onChange(next);
        }
      }}
      variant="outline"
      size="icon"
      spacing={0}
      aria-label={t('proposalViewLabel')}
      className={className}
    >
      {views.map((view) => {
        const Icon = VIEW_ICONS[view];
        const label = t(VIEW_LABEL_KEYS[view]);

        return (
          <ToggleGroupItem key={view} value={view} aria-label={label}>
            <Icon className="size-4" aria-hidden />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
