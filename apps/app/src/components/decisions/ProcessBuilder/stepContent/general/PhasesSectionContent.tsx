'use client';

import { parseDate } from '@internationalized/date';
import { trpc } from '@op/api/client';
import type { PhaseDefinition, PhaseRules } from '@op/api/encoders';
import { useDebouncedCallback } from '@op/hooks';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@op/ui/Accordion';
import { DatePicker } from '@op/ui/DatePicker';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { ToggleButton } from '@op/ui/ToggleButton';
import { cn } from '@op/ui/utils';
import { use, useState } from 'react';
import { DisclosureStateContext } from 'react-aria-components';
import { LuChevronRight, LuGripVertical } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function PhasesSectionContent({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const initialPhases = instance.process?.processSchema?.phases ?? [];
  const [phases, setPhases] = useState<PhaseDefinition[]>(initialPhases);
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

  // Debounced auto-save function (similar to ProposalEditor pattern)
  const debouncedSave = useDebouncedCallback((data: PhaseDefinition[]) => {
    setSaveStatus(decisionProfileId, 'saving');
    for (const phase of data) {
      setPhaseData(decisionProfileId, phase.id, {
        name: phase.name,
        description: phase.description,
        startDate: phase.startDate,
        endDate: phase.endDate,
        rules: phase.rules,
      });
    }

    // Save to API if in draft mode
    if (isDraft) {
      updateInstance.mutate(
        {
          instanceId,
          phases: data.map((phase) => ({
            phaseId: phase.id,
            name: phase.name,
            description: phase.description,
            startDate: phase.startDate,
            endDate: phase.endDate,
            rules: phase.rules,
          })),
        },
        {
          onSuccess: () => markSaved(decisionProfileId),
          onError: () => setSaveStatus(decisionProfileId, 'error'),
        },
      );
    } else {
      // Just mark as saved for localStorage
      markSaved(decisionProfileId);
    }
  }, AUTOSAVE_DEBOUNCE_MS);

  // Update phases and trigger debounced save
  const updatePhases = (
    updater:
      | PhaseDefinition[]
      | ((prev: PhaseDefinition[]) => PhaseDefinition[]),
  ) => {
    setPhases((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      debouncedSave(updated);
      return updated;
    });
  };

  const updatePhase = (phaseId: string, updates: Partial<PhaseDefinition>) => {
    updatePhases((prev) =>
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
        setPhases={updatePhases}
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
  phases: PhaseDefinition[];
  setPhases: (phases: PhaseDefinition[]) => void;
  updatePhase: (phaseId: string, updates: Partial<PhaseDefinition>) => void;
}) => {
  const t = useTranslations();

  // Safely parse a date string (ISO datetime or YYYY-MM-DD) to DateValue
  const safeParseDateString = (dateStr: string | undefined) => {
    if (!dateStr) {
      return undefined;
    }
    try {
      // Handle ISO datetime strings by extracting just the date part
      const datePart = dateStr.split('T')[0];
      return datePart ? parseDate(datePart) : undefined;
    } catch {
      return undefined;
    }
  };

  // Format DateValue to ISO datetime string
  const formatDateValue = (date: {
    year: number;
    month: number;
    day: number;
  }) => {
    return new Date(date.year, date.month - 1, date.day).toISOString();
  };

  if (phases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-gray3 p-8 text-center">
        <p className="text-neutral-gray4">{t('No phases defined')}</p>
      </div>
    );
  }

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
                aria-label={t('Phase name')}
              />
            </AccordionHeader>
            <AccordionContent>
              <hr />
              <div className="space-y-4 p-4">
                <div>
                  <label className="mb-1 block text-sm">
                    {t('Description')}
                  </label>
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
                    <DatePicker
                      label={t('Start date')}
                      value={safeParseDateString(phase.startDate)}
                      onChange={(date) =>
                        updatePhase(phase.id, {
                          startDate: formatDateValue(date),
                        })
                      }
                    />
                  </div>
                  <div className="flex-1">
                    <DatePicker
                      label={t('End date')}
                      value={safeParseDateString(phase.endDate)}
                      onChange={(date) =>
                        updatePhase(phase.id, {
                          endDate: formatDateValue(date),
                        })
                      }
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
  phase: PhaseDefinition;
  onUpdate: (updates: Partial<PhaseDefinition>) => void;
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
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}) => {
  const state = use(DisclosureStateContext);
  const isExpanded = state?.isExpanded ?? false;

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!isExpanded}
      aria-label={ariaLabel}
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
