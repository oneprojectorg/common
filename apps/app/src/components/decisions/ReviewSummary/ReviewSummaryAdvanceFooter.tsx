'use client';

import { Button } from '@op/ui/Button';
import { FooterBar } from '@op/ui/FooterBar';
import { LuCheck } from 'react-icons/lu';

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
      <FooterBar.Start>
        <span className="text-base text-neutral-black">
          {t('{count} proposals advancing', { count })}
        </span>
      </FooterBar.Start>
      <FooterBar.Center />
      <FooterBar.End>
        <Button
          size="small"
          color="secondary"
          onPress={toggle}
          className={
            isAdvancing
              ? 'border-primary-teal bg-primary-tealWhite text-primary-tealBlack hover:bg-primary-tealWhite'
              : undefined
          }
        >
          {isAdvancing ? <LuCheck className="size-4" /> : null}
          {isAdvancing ? t('Advancing proposal') : t('Advance proposal')}
        </Button>
      </FooterBar.End>
    </FooterBar>
  );
}
