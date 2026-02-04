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
import { ToggleButton } from '@op/ui/ToggleButton';
import { cn } from '@op/ui/utils';
import { use, useCallback, useState } from 'react';
import { DisclosureStateContext } from 'react-aria-components';
import { LuChevronRight, LuGripVertical } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

interface PhaseRules {
  proposals?: { submit?: boolean; edit?: boolean };
  voting?: { submit?: boolean; edit?: boolean };
}

interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  rules?: PhaseRules;
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

  // Only auto-save to API when in draft mode
  const isDraft = instance.status === 'draft';

  // Auto-save phases
  // TODO: Use hasPendingChanges and publishChanges in the header for "Publish Changes" button
  const {
    hasPendingChanges: _hasPendingChanges,
    publishChanges: _publishChanges,
  } = useAutoSave({
    data: phases,
    enabled: isDraft,
    onLocalSave: useCallback(
      (data: Phase[]) => {
        // Update localStorage via Zustand
        for (const phase of data) {
          setPhaseData(decisionProfileId, phase.id, {
            startDate: phase.startDate,
            endDate: phase.endDate,
            rules: phase.rules,
          });
        }
      },
      [decisionProfileId, setPhaseData],
    ),
    onApiSave: useCallback(
      async (data: Phase[]) => {
        await updateInstance.mutateAsync({
          instanceId,
          phases: data.map((phase) => ({
            phaseId: phase.id,
            startDate: phase.startDate,
            endDate: phase.endDate,
            settings: { rules: phase.rules },
          })),
        });
      },
      [instanceId, updateInstance],
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
              <hr />
              <PhaseControls
                phase={phase}
                onUpdate={(updates) => updatePhase(phase.id, updates)}
              />
            </AccordionContent>
          </AccordionItem>
        )}
      </Sortable>
    </Accordion>
  );
};

/** Controls for configuring phase behavior (proposals, voting) */
const PhaseControls = ({
  phase,
  onUpdate,
}: {
  phase: Phase;
  onUpdate: (updates: Partial<Phase>) => void;
}) => {
  const t = useTranslations();

  const updateRules = (updates: Partial<PhaseRules>) => {
    onUpdate({
      rules: {
        ...phase.rules,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-4 p-4">
      <ToggleRow label={t('Enable proposal submission')}>
        <ToggleButton
          isSelected={phase.rules?.proposals?.submit ?? false}
          onChange={(val) =>
            updateRules({
              proposals: {
                ...phase.rules?.proposals,
                submit: val,
              },
            })
          }
          size="small"
        />
      </ToggleRow>
      {phase.rules?.proposals?.submit && (
        <ToggleRow label={t('Allow proposal editing')}>
          <ToggleButton
            isSelected={phase.rules?.proposals?.edit ?? false}
            onChange={(val) =>
              updateRules({
                proposals: {
                  ...phase.rules?.proposals,
                  edit: val,
                },
              })
            }
            size="small"
          />
        </ToggleRow>
      )}
      <ToggleRow label={t('Enable voting')}>
        <ToggleButton
          isSelected={phase.rules?.voting?.submit ?? false}
          onChange={(val) =>
            updateRules({
              voting: {
                ...phase.rules?.voting,
                submit: val,
              },
            })
          }
          size="small"
        />
      </ToggleRow>
      {phase.rules?.voting?.submit && (
        <ToggleRow label={t('Allow vote changes')}>
          <ToggleButton
            isSelected={phase.rules?.voting?.edit ?? false}
            onChange={(val) =>
              updateRules({
                voting: {
                  ...phase.rules?.voting,
                  edit: val,
                },
              })
            }
            size="small"
          />
        </ToggleRow>
      )}
    </div>
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
