'use client';

import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { DevelopAdminEntriesPanel } from '../DevelopProposals/DevelopAdminEntriesPanel';
import { DevelopPageShell, getEntryName } from './DevelopPageShell';

export function DevelopAdminPage({
  instance,
  developPhase,
  decisionSlug,
}: {
  instance: ProcessInstance;
  developPhase: InstancePhaseData;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');

  return (
    <DevelopPageShell>
      <DevelopAdminEntriesPanel
        processInstanceId={instance.id}
        phaseId={developPhase.phaseId}
        decisionSlug={decisionSlug}
        entryName={getEntryName({ developPhase, t })}
      />
    </DevelopPageShell>
  );
}
