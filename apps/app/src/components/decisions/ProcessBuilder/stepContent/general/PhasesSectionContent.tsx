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
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import type { Key } from '@op/ui/RAC';
import { DisclosureStateContext } from '@op/ui/RAC';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { cn } from '@op/ui/utils';
import { use, useEffect, useRef, useState } from 'react';
import {
  LuChevronRight,
  LuCircleAlert,
  LuGripVertical,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';

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
        headline: p.headline,
        additionalInfo: p.additionalInfo,
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
  const debouncedSaveRef = useRef<() => boolean>(null);
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: () => setSaveStatus(decisionProfileId, 'error'),
    onSettled: () => {
      // Skip invalidation if another debounced save is pending — that save's
      // onSettled will reconcile. This prevents a stale refetch from overwriting
      // optimistic cache updates made between the two saves.
      if (debouncedSaveRef.current?.()) {
        return;
      }
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
      headline: phase.headline,
      additionalInfo: phase.additionalInfo,
      startDate: phase.startDate,
      endDate: phase.endDate,
      rules: phase.rules,
    }));

    // Always update the store so validation stays reactive
    setInstanceData(decisionProfileId, { phases: phasesPayload });

    if (isDraft) {
      updateInstance.mutate({ instanceId, phases: phasesPayload });
    } else {
      markSaved(decisionProfileId);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
  debouncedSaveRef.current = () => debouncedSave.isPending();

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
    <div className="mx-auto w-full space-y-4 p-4 md:max-w-160 md:p-8">
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
        instanceId={instanceId}
      />
    </div>
  );
}

export const PhaseEditor = ({
  phases,
  setPhases,
  updatePhase,
  instanceId,
}: {
  phases: PhaseDefinition[];
  setPhases: (phases: PhaseDefinition[]) => void;
  updatePhase: (phaseId: string, updates: Partial<PhaseDefinition>) => void;
  instanceId: string;
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

  // Validation: track which fields have been blurred per phase
  const [touchedFields, setTouchedFields] = useState<
    Record<string, Set<string>>
  >({});

  const markTouched = (phaseId: string, fieldName: string) => {
    setTouchedFields((prev) => {
      const phaseSet = new Set(prev[phaseId]);
      phaseSet.add(fieldName);
      return { ...prev, [phaseId]: phaseSet };
    });
  };

  // Compare the date portions of two ISO datetime strings.
  // Returns negative if a < b, 0 if equal, positive if a > b.
  const compareDateStrings = (a: string, b: string): number => {
    const dateA = a.split('T')[0] ?? '';
    const dateB = b.split('T')[0] ?? '';
    return dateA.localeCompare(dateB);
  };

  const getPhaseErrors = (phase: PhaseDefinition) => {
    const errors: Record<string, string> = {};
    if (!phase.name?.trim()) {
      errors.name = t('Phase name is required');
    }
    if (!phase.headline?.trim()) {
      errors.headline = t('Headline is required');
    }
    if (!phase.description?.trim()) {
      errors.description = t('Description is required');
    }
    if (!phase.endDate) {
      errors.endDate = t('End date is required');
    }
    // Within-phase date validation: end date must be >= start date
    if (
      phase.startDate &&
      phase.endDate &&
      compareDateStrings(phase.endDate, phase.startDate) < 0
    ) {
      errors.endDate = t('End date must be on or after the start date');
    }
    return errors;
  };

  const getErrorMessage = (
    phaseId: string,
    field: string,
    errors: Record<string, string>,
  ) => {
    return touchedFields[phaseId]?.has(field) ? errors[field] : undefined;
  };

  const phaseHasVisibleErrors = (phaseId: string) => {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) {
      return false;
    }
    const errors = getPhaseErrors(phase);
    const touched = touchedFields[phaseId];
    if (!touched) {
      return false;
    }
    return Object.keys(errors).some((field) => touched.has(field));
  };

  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());
  const [autoFocusPhaseId, setAutoFocusPhaseId] = useState<string | null>(null);
  const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null);

  const addPhase = () => {
    const newPhase: PhaseDefinition = {
      id: crypto.randomUUID().slice(0, 8),
      name: t('New phase'),
      rules: {},
    };
    setPhases([...phases, newPhase]);
    setExpandedKeys((prev) => new Set([...prev, newPhase.id]));
    setAutoFocusPhaseId(newPhase.id);
  };

  const confirmRemovePhase = () => {
    if (!phaseToDelete) {
      return;
    }
    setPhases(phases.filter((p) => p.id !== phaseToDelete));
    setTouchedFields((prev) => {
      const next = { ...prev };
      delete next[phaseToDelete];
      return next;
    });
    setPhaseToDelete(null);
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
          {(phase, { dragHandleProps, isDragging }) => {
            const errors = getPhaseErrors(phase);
            return (
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
                  <AccordionTitleInput
                    value={phase.name}
                    onChange={(name) => updatePhase(phase.id, { name })}
                    onBlur={() => markTouched(phase.id, 'name')}
                    hasError={!!getErrorMessage(phase.id, 'name', errors)}
                    aria-label={t('Phase name')}
                    autoFocus={autoFocusPhaseId === phase.id}
                    onAutoFocused={() => setAutoFocusPhaseId(null)}
                  />
                  {phaseHasVisibleErrors(phase.id) && <PhaseErrorIndicator />}
                </AccordionHeader>
                <AccordionContent>
                  <hr />
                  <div className="space-y-4 p-4">
                    <TextField
                      label={t('Headline')}
                      isRequired
                      value={phase.headline ?? ''}
                      onChange={(value) =>
                        updatePhase(phase.id, { headline: value })
                      }
                      onBlur={() => markTouched(phase.id, 'headline')}
                      errorMessage={getErrorMessage(
                        phase.id,
                        'headline',
                        errors,
                      )}
                      description={t(
                        'This text appears as the header of the page.',
                      )}
                    />
                    <TextField
                      label={t('Description')}
                      isRequired
                      useTextArea
                      value={phase.description ?? ''}
                      onChange={(value) =>
                        updatePhase(phase.id, { description: value })
                      }
                      onBlur={() => markTouched(phase.id, 'description')}
                      errorMessage={getErrorMessage(
                        phase.id,
                        'description',
                        errors,
                      )}
                      textareaProps={{ rows: 3 }}
                      description={t(
                        'This text appears below the headline on the phase page.',
                      )}
                    />
                    <div className="space-y-2">
                      <label className="block text-sm">
                        {t('Additional information')}
                      </label>
                      <RichTextEditorWithToolbar
                        content={phase.additionalInfo ?? ''}
                        onChange={(content) =>
                          updatePhase(phase.id, { additionalInfo: content })
                        }
                        toolbarPosition="bottom"
                        className="rounded-md border border-border"
                        editorClassName="min-h-24 p-3"
                      />
                      <p className="text-sm text-neutral-gray4">
                        {t(
                          'Any additional information will appear in a modal titled "About the process"',
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1">
                        <DatePicker
                          label={t('Start date')}
                          value={safeParseDateString(phase.startDate)}
                          maxValue={safeParseDateString(phase.endDate)}
                          onChange={(date) =>
                            updatePhase(phase.id, {
                              startDate: formatDateValue(date),
                            })
                          }
                        />
                      </div>
                      <div
                        className="flex-1"
                        onBlur={() => markTouched(phase.id, 'endDate')}
                      >
                        <DatePicker
                          label={t('End date')}
                          isRequired
                          value={safeParseDateString(phase.endDate)}
                          minValue={safeParseDateString(phase.startDate)}
                          onChange={(date) => {
                            updatePhase(phase.id, {
                              endDate: formatDateValue(date),
                            });
                            markTouched(phase.id, 'endDate');
                          }}
                          errorMessage={getErrorMessage(
                            phase.id,
                            'endDate',
                            errors,
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  <PhaseControls
                    phase={phase}
                    instanceId={instanceId}
                    onUpdate={(updates) => updatePhase(phase.id, updates)}
                  />
                  <div className="border-t p-4">
                    <Button
                      color="secondary"
                      className="text-functional-red"
                      onPress={() => setPhaseToDelete(phase.id)}
                      isDisabled={phases.length <= 1}
                    >
                      <LuTrash2 className="size-4" />
                      {t('Delete phase')}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          }}
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
      <Modal
        isDismissable
        isOpen={phaseToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPhaseToDelete(null);
          }
        }}
      >
        <ModalHeader>{t('Delete phase')}</ModalHeader>
        <ModalBody>
          <p>
            {t(
              'Are you sure you want to delete this phase? This action cannot be undone.',
            )}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            className="w-full sm:w-fit"
            onPress={() => setPhaseToDelete(null)}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="destructive"
            className="w-full sm:w-fit"
            onPress={confirmRemovePhase}
          >
            {t('Delete')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

/** Controls for configuring phase behavior (proposals, voting) */
const PhaseControls = ({
  phase,
  instanceId,
  onUpdate,
}: {
  phase: PhaseDefinition;
  instanceId: string;
  onUpdate: (updates: Partial<PhaseDefinition>) => void;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const updateRules = (updates: Partial<PhaseRules>) => {
    const newRules = { ...phase.rules, ...updates };
    onUpdate({ rules: newRules });

    // Optimistically update getInstance cache so useNavigationConfig reacts instantly
    utils.decision.getInstance.setData({ instanceId }, (old) => {
      if (!old?.instanceData?.phases) {
        return old;
      }
      return {
        ...old,
        instanceData: {
          ...old.instanceData,
          phases: old.instanceData.phases.map((p) =>
            p.phaseId === phase.id ? { ...p, rules: newRules } : p,
          ),
        },
      };
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
  onBlur,
  hasError,
  autoFocus,
  onAutoFocused,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  autoFocus?: boolean;
  onAutoFocused?: () => void;
  'aria-label'?: string;
}) => {
  const t = useTranslations();
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
    <div className="flex grow items-center justify-between gap-2">
      <AutoSizeInput
        inputRef={inputRef}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={cn(
          'rounded border px-2 py-1 font-serif text-title-sm focus-within:bg-white',
          hasError
            ? 'border-functional-red bg-white'
            : 'border-neutral-gray1 bg-neutral-gray1 focus-within:border-neutral-gray3',
        )}
        aria-label={ariaLabel ?? ''}
      />
      {hasError && (
        <p className="text-functional-red">
          {t('Add a label for this phase.')}
        </p>
      )}
    </div>
  );
};

/** Warning icon shown on collapsed accordion headers when a phase has validation errors */
const PhaseErrorIndicator = () => {
  const t = useTranslations();
  const state = use(DisclosureStateContext);
  const isExpanded = state?.isExpanded ?? false;

  if (isExpanded) {
    return null;
  }

  return (
    <span
      className="text-functional-red"
      aria-label={t('This phase has validation errors')}
    >
      <LuCircleAlert className="size-4" />
    </span>
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
