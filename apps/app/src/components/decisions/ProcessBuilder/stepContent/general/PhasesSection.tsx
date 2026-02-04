'use client';

import { trpc } from '@op/api/client';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@op/ui/Accordion';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { cn } from '@op/ui/utils';
import { use, useCallback, useState } from 'react';
import { DisclosureStateContext } from 'react-aria-components';
import { LuChevronRight, LuGripVertical } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export default function PhasesSection({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const initialPhases = instance.process?.processSchema?.phases ?? [];
  const [phases, setPhases] = useState<Phase[]>(initialPhases);
  const t = useTranslations();

  // Store and mutation for saving
  const setPhaseData = useProcessBuilderStore((s) => s.setPhaseData);
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  // Auto-save phases
  useAutoSave({
    data: phases,
    onSave: useCallback(
      async (data: Phase[]) => {
        // Update localStorage via Zustand
        for (const phase of data) {
          setPhaseData(decisionProfileId, phase.id, {
            startDate: phase.startDate,
            endDate: phase.endDate,
          });
        }

        // Save to API
        await updateInstance.mutateAsync({
          instanceId,
          phases: data.map((phase) => ({
            phaseId: phase.id,
            startDate: phase.startDate,
            endDate: phase.endDate,
          })),
        });
      },
      [decisionProfileId, instanceId, setPhaseData, updateInstance],
    ),
    setSaveStatus: useCallback(
      (status) => setSaveStatus(decisionProfileId, status),
      [decisionProfileId, setSaveStatus],
    ),
    markSaved: useCallback(
      () => markSaved(decisionProfileId),
      [decisionProfileId, markSaved],
    ),
  });

  const updatePhase = (phaseId: string, updates: Partial<Phase>) => {
    setPhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId ? { ...phase, ...updates } : phase,
      ),
    );
  };

  return (
    <div className="mx-auto w-full max-w-160 space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-sm">{t('Phases')}</h2>
        <SaveStatusIndicator
          status={saveState.status}
          savedAt={saveState.savedAt}
        />
      </div>
      <p className="text-neutral-charcoal">
        {t('Define the phases of your decision-making process')}
      </p>
      <PhaseEditor
        phases={phases}
        setPhases={setPhases}
        updatePhase={updatePhase}
      />
    </div>
  );
}

export const PhaseEditor = ({
  phases,
  setPhases,
  updatePhase,
}: {
  phases: Phase[];
  setPhases: (phases: Phase[]) => void;
  updatePhase: (phaseId: string, updates: Partial<Phase>) => void;
}) => {
  return (
    <Accordion allowsMultipleExpanded variant="unstyled">
      <Sortable
        items={phases}
        onChange={setPhases}
        dragTrigger="handle"
        getItemLabel={(phase) => phase.name}
        className="gap-2"
        renderDragPreview={(items) => (
          <PhaseDragPreview name={items[0]?.name} />
        )}
        renderDropIndicator={PhaseDropIndicator}
      >
        {(phase, { dragHandleProps, isDragging }) => (
          <AccordionItem
            id={phase.id}
            className={cn(
              'rounded-lg border bg-white',
              isDragging && 'opacity-50',
            )}
          >
            <AccordionHeader className="flex items-center gap-2 px-3 py-2">
              <DragHandle {...dragHandleProps} />
              <AccordionTrigger className="flex items-center gap-2">
                <AccordionIndicator />
              </AccordionTrigger>
              <AccordionTitleInput
                value={phase.name}
                onChange={(name) => updatePhase(phase.id, { name })}
              />
            </AccordionHeader>
            <AccordionContent>
              <hr />
              <div className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-sm">Description</label>
                  <textarea
                    rows={3}
                    value={phase.description ?? ''}
                    onChange={(e) =>
                      updatePhase(phase.id, { description: e.target.value })
                    }
                    className="w-full rounded-md border border-border px-3 py-2"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm">Start date</label>
                    <input
                      type="date"
                      value={phase.startDate ?? ''}
                      onChange={(e) =>
                        updatePhase(phase.id, { startDate: e.target.value })
                      }
                      className="w-full rounded-md border border-border px-3 py-2"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm">End date</label>
                    <input
                      type="date"
                      value={phase.endDate ?? ''}
                      onChange={(e) =>
                        updatePhase(phase.id, { endDate: e.target.value })
                      }
                      className="w-full rounded-md border border-border px-3 py-2"
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Sortable>
    </Accordion>
  );
};

/** Input that is only editable when the accordion is expanded */
const AccordionTitleInput = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const state = use(DisclosureStateContext);
  const isExpanded = state?.isExpanded ?? false;

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!isExpanded}
      className={cn(
        'flex-1 rounded border bg-transparent px-2 py-1 font-serif text-title-sm',
        'disabled:cursor-default disabled:border-transparent',
        'enabled:bg-neutral-gray1 enabled:focus:border enabled:focus:bg-white',
        className,
      )}
    />
  );
};

/** Element to show when a phase is being dragged */
const PhaseDragPreview = ({ name }: { name?: string }) => {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
      <div className="p-1">
        <LuGripVertical size={16} />
      </div>
      <LuChevronRight size={16} />
      <p className="px-2 py-1 font-serif text-title-sm">{name}</p>
    </div>
  );
};

/** DropIndicator to show when a phase is being dragged */
const PhaseDropIndicator = () => {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite"></div>
  );
};
