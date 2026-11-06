'use client';

import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Toggle } from '@op/sense/Toggle';
import { useMemo } from 'react';
import { LuCheck, LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AwardCell } from '../selection/AwardCell';
import { useManualAwardDraft } from '../useManualAwardDraft';
import { useManualSelection } from '../useManualSelection';
import { type AwardProposal, useProposalAwards } from '../useProposalAwards';

interface ReviewSummaryAdvanceFooterProps {
  instanceId: string;
  phaseId: string | undefined;
  /** Source for the requested amount when the selection awards money. */
  proposal: AwardProposal;
  /** Resolved display title — the accessible name on the award controls. */
  proposalTitle: string;
  /**
   * True when confirming this selection publishes funded results, so the
   * advance decision carries an award amount (mirrors
   * `ReviewSelectionList`'s `isFinalPhase && showBudget`).
   */
  awardsAmounts: boolean;
  processBudget?: number;
}

export function ReviewSummaryAdvanceFooter({
  instanceId,
  phaseId,
  proposal,
  proposalTitle,
  awardsAmounts,
  processBudget,
}: ReviewSummaryAdvanceFooterProps) {
  const t = useTranslations('decisions.review');
  // Both drafts share the selection table's keys (`previousPhaseId` there,
  // this summary's phase here), so edits appear in the table instantly.
  const [selectedIds, setSelectedIds] = useManualSelection(
    instanceId,
    phaseId ?? '',
  );
  const awardDraft = useManualAwardDraft(instanceId, phaseId ?? '');
  const proposals = useMemo(() => [proposal], [proposal]);
  const awards = useProposalAwards({
    proposals,
    selectedIds,
    isEnabled: awardsAmounts,
    processBudget,
    draft: awardDraft,
  });

  const isAdvancing = selectedIds.includes(proposal.id);
  const count = selectedIds.length;

  const toggle = () => {
    setSelectedIds(
      isAdvancing
        ? selectedIds.filter((id) => id !== proposal.id)
        : [...selectedIds, proposal.id],
    );
  };

  return (
    <FooterBar position="fixed" className="bg-muted/95">
      <FooterBarStart>
        <span className="flex items-center gap-2 text-base">
          <LuCircleCheck className="size-4 text-muted-foreground" aria-hidden />
          {t('proposalsAdvancingCount', { count })}
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        {awardsAmounts ? (
          // The selection table's award controls, bound to the same shared
          // drafts — so a winner picked here gets its amount here too.
          <AwardCell
            proposalId={proposal.id}
            title={proposalTitle}
            awards={awards}
            isSelected={isAdvancing}
            onToggle={toggle}
          />
        ) : (
          /* Same control as the selection table's `AdvanceToggleButton` — a
             pressed Toggle, so the selected look comes from the shared
             `aria-pressed` styling instead of hand-rolled classes. */
          <Toggle
            variant="outline"
            size="sm"
            pressed={isAdvancing}
            onPressedChange={toggle}
          >
            {isAdvancing ? <LuCheck className="size-4" /> : null}
            {isAdvancing
              ? t('advancingProposalStatus')
              : t('advanceProposalAction')}
          </Toggle>
        )}
      </FooterBarEnd>
    </FooterBar>
  );
}
