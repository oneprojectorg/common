'use client';

import type { Proposal } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { useState } from 'react';
import { LuArrowRight } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ConfirmAdvanceProposalsModal } from './ConfirmAdvanceProposalsModal';

interface AdvancePhaseButtonProps {
  instanceId: string;
  proposals: Proposal[];
  budget?: number;
}

export function AdvancePhaseButton({
  instanceId,
  proposals,
  budget,
}: AdvancePhaseButtonProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button color="primary" onPress={() => setIsOpen(true)}>
        <span>{t('Confirm proposals to advance')}</span>
        <LuArrowRight className="size-4" />
      </Button>
      <ConfirmAdvanceProposalsModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        instanceId={instanceId}
        proposals={proposals}
        budget={budget}
      />
    </>
  );
}
