'use client';

import { useEffect, useRef } from 'react';

import { ProcessBuilderContent } from './ProcessBuilderContent';
import { ProcessBuilderSidebar } from './ProcessBuilderSectionNav';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';

interface ProcessBuilderEditAreaProps {
  decisionProfileId: string;
  instanceId: string;
  decisionName: string;
}

export function ProcessBuilderEditArea({
  decisionProfileId,
  instanceId,
  decisionName,
}: ProcessBuilderEditAreaProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const navigationConfig = useNavigationConfig(instanceId, decisionProfileId);
  const phases = useProcessPhases(instanceId, decisionProfileId);
  const { currentSection } = useProcessNavigation(navigationConfig, phases);

  useEffect(() => {
    outerRef.current?.scrollTo({ top: 0 });
    mainRef.current?.scrollTo({ top: 0 });
  }, [currentSection?.id]);

  return (
    <div
      ref={outerRef}
      className="flex min-h-0 grow flex-col overflow-y-auto md:flex-row md:overflow-y-hidden"
    >
      <ProcessBuilderSidebar
        instanceId={instanceId}
        decisionProfileId={decisionProfileId}
      />
      <main ref={mainRef} className="h-full grow overflow-y-auto">
        <ProcessBuilderContent
          decisionProfileId={decisionProfileId}
          instanceId={instanceId}
          decisionName={decisionName}
        />
      </main>
    </div>
  );
}
