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
import { AutoSizeInput } from '@op/ui/AutoSizeInput';
import { Button } from '@op/ui/Button';
import { DatePicker } from '@op/ui/DatePicker';
import type { Key } from '@op/ui/RAC';
import { DisclosureStateContext } from '@op/ui/RAC';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { ToggleButton } from '@op/ui/ToggleButton';
import { cn } from '@op/ui/utils';
import { use, useEffect, useRef, useState } from 'react';
import { LuChevronRight, LuGripVertical, LuPlus, LuX } from 'react-icons/lu';

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
  const instancePhases = instance.instanceData?.phases;
  const templatePhases = instance.process?.processSchema?.phases;
  const isDraft = instance.status === 'draft';

  // Store: used as a localStorage buffer for non-draft edits only
  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

  // Non-draft: prefer store (localStorage buffer) over API data.
  // Draft: use API data (query cache kept fresh via onSettled invalidation).
  const initialPhases: PhaseDefinition[] = (() => {
    const source =
      !isDraft && storePhases?.length ? storePhases : instancePhases;
    return (
      source?.map((p) => ({
        id: p.phaseId,
        name: p.name ?? '',
        description: p.description,
        rules: p.rules ?? {},
        startDate: p.startDate,
        endDate: p.endDate,
      })) ??
      templatePhases ??
      []
    );
  })();
  const [phases, setPhases] = useState<PhaseDefinition[]>(initialPhases);
  const t = useTranslations();

  const utils = trpc.useUtils();
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: () => setSaveStatus(decisionProfileId, 'error'),
    onSettled: () => {
      void utils.decision.getInstance.invalidate({ instanceId });
    },
  });

  // Debounced save: draft persists to API, non-draft buffers in localStorage.
  const debouncedSave = useDebouncedCallback((data: PhaseDefinition[]) => {
    setSaveStatus(decisionProfileId, 'saving');

    const phasesPayload = data.map((phase) => ({
      phaseId: phase.id,
      name: phase.name,
      description: phase.description,
      startDate: phase.startDate,
      endDate: phase.endDate,
      rules: phase.rules,
    }));

    if (isDraft) {
      updateInstance.mutate({ instanceId, phases: phasesPayload });
    } else {
      setInstanceData(decisionProfileId, { phases: phasesPayload });
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

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [autoFocusPhaseId, setAutoFocusPhaseId] = useState<string | null>(null);

  const addPhase = () => {
    const newPhase: PhaseDefinition = {
      id: crypto.randomUUID(),
      name: t('New phase'),
      rules: {},
    };
    setPhases([...phases, newPhase]);
    setExpandedKeys((prev) => new Set([...prev, newPhase.id]));
    setAutoFocusPhaseId(newPhase.id);
  };

  const removePhase = (phaseId: string) => {
    setPhases(phases.filter((p) => p.id !== phaseId));
  };

  if (phases.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-neutral-gray3 p-8 text-center">
          <p className="text-neutral-gray4">{t('No phases defined')}</p>
        </div>
        <Button
          color="ghost"
          className="text-primary-teal hover:text-primary-tealBlack"
          onPress={addPhase}
        >
          <LuPlus className="size-4" />
          {t('Add phase')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Accordion
        allowsMultipleExpanded
        variant="unstyled"
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      >
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
                <AccordionTrigger className="flex cursor-pointer items-center">
                  <AccordionIndicator />
                </AccordionTrigger>
                <div className="grow">
                  <AccordionTitleInput
                    value={phase.name}
                    onChange={(name) => updatePhase(phase.id, { name })}
                    aria-label={t('Phase name')}
                    autoFocus={autoFocusPhaseId === phase.id}
                    onAutoFocused={() => setAutoFocusPhaseId(null)}
                  />
                </div>
                <RemovePhaseButton
                  onPress={() => removePhase(phase.id)}
                  isDisabled={phases.length <= 1}
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
                <PhaseControls
                  phase={phase}
                  onUpdate={(updates) => updatePhase(phase.id, updates)}
                />
              </AccordionContent>
            </AccordionItem>
          )}
        </Sortable>
      </Accordion>
      <Button
        color="secondary"
        className="w-full text-primary-teal hover:text-primary-tealBlack"
        onPress={addPhase}
      >
        <LuPlus className="size-4" />
        {t('Add phase')}
      </Button>
    </div>
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
    <div className="space-y-6 p-4">
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
      <ToggleRow label={t('Enable proposal editing')}>
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
      <ToggleRow label={t('Enable proposal review')}>
        <ToggleButton
          isSelected={phase.rules?.proposals?.review ?? false}
          onChange={(val) =>
            updateRules({
              proposals: {
                ...phase.rules?.proposals,
                review: val,
              },
            })
          }
          size="small"
        />
      </ToggleRow>
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
    </div>
  );
};

/** Input that is only editable when the accordion is expanded */
const AccordionTitleInput = ({
  value,
  onChange,
  autoFocus,
  onAutoFocused,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onAutoFocused?: () => void;
  'aria-label'?: string;
}) => {
  const state = use(DisclosureStateContext);
  const isExpanded = state?.isExpanded ?? false;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && isExpanded && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      onAutoFocused?.();
    }
  }, [autoFocus, isExpanded, onAutoFocused]);

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="w-full cursor-pointer rounded border border-transparent px-2 py-1 text-left font-serif text-title-sm"
        onClick={() => state?.expand()}
      >
        {value}
      </button>
    );
  }

  return (
    <AutoSizeInput
      inputRef={inputRef}
      value={value}
      onChange={onChange}
      className="rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1 font-serif text-title-sm focus-within:border-neutral-gray3 focus-within:bg-white"
      aria-label={ariaLabel ?? ''}
    />
  );
};

/** Remove button that only appears when the accordion item is expanded */
const RemovePhaseButton = ({
  onPress,
  isDisabled,
}: {
  onPress: () => void;
  isDisabled: boolean;
}) => {
  const t = useTranslations();
  const state = use(DisclosureStateContext);
  const isExpanded = state?.isExpanded ?? false;

  if (!isExpanded) {
    return null;
  }

  return (
    <Button
      color="ghost"
      size="small"
      className="text-neutral-gray4 hover:text-red-600"
      onPress={onPress}
      isDisabled={isDisabled}
      aria-label={t('Remove')}
    >
      <LuX className="size-4" />
    </Button>
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
