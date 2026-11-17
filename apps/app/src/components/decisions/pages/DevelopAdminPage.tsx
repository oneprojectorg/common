'use client';

import type { ProcessInstance } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import { DevelopAdminEntriesPanel } from '../DevelopProposals/DevelopAdminEntriesPanel';
import { DevelopPageShell, getEntryName } from './DevelopPageShell';

export function DevelopAdminPage({
  instance,
  decisionSlug,
}: {
  instance: ProcessInstance;
  decisionSlug: string;
}) {
  const t = useTranslations('decisions');
  const phases = instance.instanceData.phases ?? [];
  const developPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  return (
    <DevelopPageShell>
      <DevelopAdminEntriesPanel
        processInstanceId={instance.id}
        phaseId={instance.currentStateId ?? undefined}
        decisionSlug={decisionSlug}
        entryName={getEntryName({ developPhase, t })}
      />
    </DevelopPageShell>
  );
}
