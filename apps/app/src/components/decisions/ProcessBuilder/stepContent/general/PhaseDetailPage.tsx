'use client';

import { parseDate } from '@internationalized/date';
import { trpc } from '@op/api/client';
import type { PhaseDefinition, PhaseRules } from '@op/api/encoders';
import { useDebouncedCallback } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { DatePicker } from '@op/ui/DatePicker';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { useRef, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { sectionIdToPhaseId } from '../../navigationConfig';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { useProcessNavigation } from '../../useProcessNavigation';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function PhaseDetailPage({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const { currentSection, setSection } = useProcessNavigation();
  const phaseId = currentSection
    ? sectionIdToPhaseId(currentSection.id)
    : null;

  if (!phaseId) {
    return null;
  }

  return (
    <PhaseDetailForm
      key={phaseId}
      instanceId={instanceId}
      decisionProfileId={decisionProfileId}
      phaseId={phaseId}
      onDelete={() => setSection('phases')}
    />
  );
}

function PhaseDetailForm({
  instanceId,
  decisionProfileId,
  phaseId,
  onDelete,
}: {
  instanceId: string;
  decisionProfileId: string;
  phaseId: string;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instancePhases = instance.instanceData?.phases;
  const templatePhases = instance.process?.processSchema?.phases;
  const isDraft = instance.status === 'draft';

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

  // Resolve the initial phase data (same priority as PhasesSectionContent)
  const allPhases: PhaseDefinition[] = (() => {
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

  const initialPhase = allPhases.find((p) => p.id === phaseId);
  const [phase, setPhase] = useState<PhaseDefinition | undefined>(
    initialPhase,
  );

  const utils = trpc.useUtils();
  const debouncedSaveRef = useRef<() => boolean>(null);
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: () => setSaveStatus(decisionProfileId, 'error'),
    onSettled: () => {
      if (debouncedSaveRef.current?.()) {
        return;
      }
      void utils.decision.getInstance.invalidate({ instanceId });
    },
  });

  const debouncedSave = useDebouncedCallback(
    (updatedPhase: PhaseDefinition) => {
      setSaveStatus(decisionProfileId, 'saving');

      // Build the full phases array with this phase updated
      const phasesPayload = allPhases.map((p) => {
        const source = p.id === phaseId ? updatedPhase : p;
        return {
          phaseId: source.id,
          name: source.name,
          description: source.description,
          headline: source.headline,
          additionalInfo: source.additionalInfo,
          startDate: source.startDate,
          endDate: source.endDate,
          rules: source.rules,
        };
      });

      setInstanceData(decisionProfileId, { phases: phasesPayload });

      if (isDraft) {
        updateInstance.mutate({ instanceId, phases: phasesPayload });
      } else {
        markSaved(decisionProfileId);
      }
    },
    AUTOSAVE_DEBOUNCE_MS,
  );
  debouncedSaveRef.current = () => debouncedSave.isPending();

  const updatePhase = (updates: Partial<PhaseDefinition>) => {
    setPhase((prev) => {
      if (!prev) {
        return prev;
      }
      const updated = { ...prev, ...updates };
      debouncedSave(updated);
      return updated;
    });
  };

  const updateRules = (updates: Partial<PhaseRules>) => {
    if (!phase) {
      return;
    }
    const newRules = { ...phase.rules, ...updates };
    updatePhase({ rules: newRules });

    // Optimistically update getInstance cache so useNavigationConfig reacts
    utils.decision.getInstance.setData({ instanceId }, (old) => {
      if (!old?.instanceData?.phases) {
        return old;
      }
      return {
        ...old,
        instanceData: {
          ...old.instanceData,
          phases: old.instanceData.phases.map((p) =>
            p.phaseId === phaseId ? { ...p, rules: newRules } : p,
          ),
        },
      };
    });
  };

  // Delete phase
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const confirmDelete = () => {
    setSaveStatus(decisionProfileId, 'saving');
    const remainingPhases = allPhases
      .filter((p) => p.id !== phaseId)
      .map((p) => ({
        phaseId: p.id,
        name: p.name,
        description: p.description,
        headline: p.headline,
        additionalInfo: p.additionalInfo,
        startDate: p.startDate,
        endDate: p.endDate,
        rules: p.rules,
      }));

    setInstanceData(decisionProfileId, { phases: remainingPhases });

    if (isDraft) {
      updateInstance.mutate(
        { instanceId, phases: remainingPhases },
        {
          onSuccess: () => {
            onDelete();
          },
        },
      );
    } else {
      markSaved(decisionProfileId);
      onDelete();
    }
  };

  // Validation
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const markTouched = (field: string) => {
    setTouchedFields((prev) => new Set(prev).add(field));
  };

  const getErrors = () => {
    if (!phase) {
      return {};
    }
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
    if (phase.startDate && phase.endDate) {
      const startPart = phase.startDate.split('T')[0] ?? '';
      const endPart = phase.endDate.split('T')[0] ?? '';
      if (endPart.localeCompare(startPart) < 0) {
        errors.endDate = t('End date must be on or after the start date');
      }
    }
    return errors;
  };

  const errors = getErrors();
  const getErrorMessage = (field: string) =>
    touchedFields.has(field) ? errors[field] : undefined;

  // Date helpers
  const safeParseDateString = (dateStr: string | undefined) => {
    if (!dateStr) {
      return undefined;
    }
    try {
      const datePart = dateStr.split('T')[0];
      return datePart ? parseDate(datePart) : undefined;
    } catch {
      return undefined;
    }
  };

  const formatDateValue = (date: {
    year: number;
    month: number;
    day: number;
  }) => {
    return new Date(date.year, date.month - 1, date.day).toISOString();
  };

  if (!phase) {
    return null;
  }

  return (
    <div className="mx-auto w-full space-y-4 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-sm">{phase.name || t('Phases')}</h2>
        <SaveStatusIndicator
          status={saveState.status}
          savedAt={saveState.savedAt}
        />
      </div>

      <div className="space-y-4">
        <TextField
          label={t('Phase name')}
          isRequired
          value={phase.name ?? ''}
          onChange={(value) => updatePhase({ name: value })}
          onBlur={() => markTouched('name')}
          errorMessage={getErrorMessage('name')}
        />
        <TextField
          label={t('Headline')}
          isRequired
          value={phase.headline ?? ''}
          onChange={(value) => updatePhase({ headline: value })}
          onBlur={() => markTouched('headline')}
          errorMessage={getErrorMessage('headline')}
          description={t('This text appears as the header of the page.')}
        />
        <TextField
          label={t('Description')}
          isRequired
          useTextArea
          value={phase.description ?? ''}
          onChange={(value) => updatePhase({ description: value })}
          onBlur={() => markTouched('description')}
          errorMessage={getErrorMessage('description')}
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
            onChange={(content) => updatePhase({ additionalInfo: content })}
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
                updatePhase({ startDate: formatDateValue(date) })
              }
            />
          </div>
          <div
            className="flex-1"
            onBlur={() => markTouched('endDate')}
          >
            <DatePicker
              label={t('End date')}
              isRequired
              value={safeParseDateString(phase.endDate)}
              minValue={safeParseDateString(phase.startDate)}
              onChange={(date) => {
                updatePhase({ endDate: formatDateValue(date) });
                markTouched('endDate');
              }}
              errorMessage={getErrorMessage('endDate')}
            />
          </div>
        </div>
      </div>

      {/* Phase controls */}
      <div className="space-y-6 rounded-lg border p-4">
        <ToggleRow label={t('Enable proposal submission')}>
          <ToggleButton
            isSelected={phase.rules?.proposals?.submit ?? false}
            onChange={(val) =>
              updateRules({
                proposals: { ...phase.rules?.proposals, submit: val },
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
                proposals: { ...phase.rules?.proposals, edit: val },
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
                proposals: { ...phase.rules?.proposals, review: val },
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
                voting: { ...phase.rules?.voting, submit: val },
              })
            }
            size="small"
          />
        </ToggleRow>
      </div>

      {/* Delete */}
      <div className="border-t pt-4">
        <Button
          color="secondary"
          className="text-functional-red"
          onPress={() => setShowDeleteModal(true)}
        >
          <LuTrash2 className="size-4" />
          {t('Delete phase')}
        </Button>
      </div>

      <Modal
        isDismissable
        isOpen={showDeleteModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteModal(false);
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
            onPress={() => setShowDeleteModal(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="destructive"
            className="w-full sm:w-fit"
            onPress={confirmDelete}
          >
            {t('Delete')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
