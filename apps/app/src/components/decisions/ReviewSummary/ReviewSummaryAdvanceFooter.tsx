'use client';

import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Toggle } from '@op/sense/Toggle';
import { LuCheck, LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useManualSelection } from '../useManualSelection';

interface ReviewSummaryAdvanceFooterProps {
  instanceId: string;
  proposalId: string;
  phaseId: string | undefined;
}

export function ReviewSummaryAdvanceFooter({
  instanceId,
  proposalId,
  phaseId,
}: ReviewSummaryAdvanceFooterProps) {
  const t = useTranslations();
  const [selectedIds, setSelectedIds] = useManualSelection(
    instanceId,
    phaseId ?? '',
  );

  const isAdvancing = selectedIds.includes(proposalId);
  const count = selectedIds.length;

  const toggle = () => {
    setSelectedIds(
      isAdvancing
        ? selectedIds.filter((id) => id !== proposalId)
        : [...selectedIds, proposalId],
    );
  };

  return (
    <FooterBar position="fixed" className="bg-neutral-offWhite/95">
      <FooterBarStart>
        <span className="flex items-center gap-2 text-base text-foreground">
          <LuCircleCheck className="size-4 text-muted-foreground" aria-hidden />
          {t('{count} proposals advancing', { count })}
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        {/* Same control as the selection table's `AdvanceToggleButton` — a
            pressed Toggle, so the selected look comes from the shared
            `aria-pressed` styling instead of hand-rolled classes. */}
        <Toggle
          variant="outline"
          size="sm"
          pressed={isAdvancing}
          onPressedChange={toggle}
        >
          {isAdvancing ? <LuCheck className="size-4" /> : null}
          {isAdvancing ? t('Advancing proposal') : t('Advance proposal')}
        </Toggle>
      </FooterBarEnd>
    </FooterBar>
  );
}
