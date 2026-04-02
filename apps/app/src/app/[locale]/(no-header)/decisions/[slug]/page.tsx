'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { notFound, useParams } from 'next/navigation';

import { DecisionPageClient } from '@/components/decisions/DecisionPageClient';

export default function DecisionPage() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    notFound();
  }

  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;
  const ownerSlug = decisionProfile.processInstance.owner?.slug;

  if (!ownerSlug) {
    notFound();
  }

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  if (!instance) {
    notFound();
  }

  const instancePhases = instance.instanceData?.phases ?? [];
  const processSchema = instance.process?.processSchema;
  const templateStates =
    processSchema && 'states' in processSchema && Array.isArray(processSchema.states)
      ? processSchema.states
      : processSchema?.phases ?? [];

  const phases: ProcessPhase[] = instancePhases.map((phase) => {
    const templateState = templateStates.find((state) => {
      return state.id === phase.phaseId;
    });

    return {
      id: phase.phaseId,
      name: phase.name || templateState?.name,
      description: phase.description || templateState?.description,
      type: templateState?.type,
      config: templateState?.config,
      phase: templateState?.phase || {
        startDate: phase.startDate,
        endDate: phase.endDate,
      },
    };
  });

  const title =
    decisionProfile.name ||
    instance.name ||
    instance.instanceData?.templateName ||
    instance.process?.name ||
    '';

  return (
    <DecisionPageClient
      currentStateId={instance.currentStateId || ''}
      decisionProfileId={decisionProfile.id}
      decisionSlug={slug}
      instanceId={instanceId}
      isAdmin={decisionProfile.processInstance.access?.admin}
      isResultsPhase={instance.currentStateId === 'results'}
      phases={phases}
      slug={ownerSlug}
      title={title}
    />
  );
}
