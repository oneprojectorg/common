'use client';

import { parseAbsoluteToLocal, toCalendarDate } from '@internationalized/date';
import { trpc } from '@op/api/client';
import type { PhaseDefinition, PhaseRules } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { DatePicker } from '@op/ui/DatePicker';
import { Header2 } from '@op/ui/Header';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { useQueryState } from 'nuqs';
import { useRef, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';

import { useProcessBuilderAutosave } from '../../ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { isPhaseSection, sectionIdToPhaseId } from '../../navigationConfig';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

export function PhaseDetailPage({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [sectionParam, setSectionParam] = useQueryState('section', {
    history: 'push',
  });
  const phaseId =
    sectionParam && isPhaseSection(sectionParam)
      ? sectionIdToPhaseId(sectionParam)
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
      onDelete={() => setSectionParam('phases')}
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

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const { saveChanges, saveState } = useProcessBuilderAutosave();

  // Resolve the initial phase data (same priority as PhasesSectionContent)
  const allPhases: PhaseDefinition[] = (() => {
    const source = storePhases?.length ? storePhases : instancePhases;
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

  const phaseIndex = allPhases.findIndex((p) => p.id === phaseId) + 1;
  const phaseCount = allPhases.length;

  const initialPhase = allPhases.find((p) => p.id === phaseId);
  const [phase, setPhase] = useState<PhaseDefinition | undefined>(initialPhase);

  const allPhasesRef = useRef(allPhases);
  allPhasesRef.current = allPhases;

  const toPayload = (phases: PhaseDefinition[]) =>
    phases.map((p) => ({
      phaseId: p.id,
      name: p.name,
      description: p.description,
      headline: p.headline,
      additionalInfo: p.additionalInfo,
      startDate: p.startDate,
      endDate: p.endDate,
      rules: p.rules,
    }));

  const updatePhase = (updates: Partial<PhaseDefinition>) => {
    setPhase((prev) => {
      if (!prev) {
        return prev;
      }
      const updated = { ...prev, ...updates };
      const phasesPayload = toPayload(
        allPhasesRef.current.map((p) => (p.id === phaseId ? updated : p)),
      );
      saveChanges({ phases: phasesPayload });
      return updated;
    });
  };

  const updateRules = (updates: Partial<PhaseRules>) => {
    if (!phase) {
      return;
    }
    const newRules = { ...phase.rules, ...updates };
    updatePhase({ rules: newRules });
  };

  // Delete phase
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const confirmDelete = () => {
    const remainingPhases = allPhases.filter((p) => p.id !== phaseId);
    saveChanges({ phases: toPayload(remainingPhases) });
    onDelete();
  };

  // Validation
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const markTouched = (field: string) => {
    setTouchedFields((prev) => new Set(prev).add(field));
  };

  const safeParseLocal = (dateStr: string | undefined) => {
    if (!dateStr) {
      return undefined;
    }
    try {
      return toCalendarDate(parseAbsoluteToLocal(dateStr));
    } catch {
      return undefined;
    }
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
      const start = safeParseLocal(phase.startDate);
      const end = safeParseLocal(phase.endDate);
      if (start && end && end.compare(start) < 0) {
        errors.endDate = t('End date must be on or after the start date');
      }
    }
    return errors;
  };

  const errors = getErrors();
  const getErrorMessage = (field: string) =>
    touchedFields.has(field) ? errors[field] : undefined;

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
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-gray4">
            {t('Phase {index} of {total}', {
              index: phaseIndex,
              total: phaseCount,
            })}
          </p>
          <Header2 className="font-serif text-title-base">
            {t('Add phase')}
          </Header2>
        </div>
        <SaveStatusIndicator
          status={saveState.status}
          savedAt={saveState.savedAt}
        />
      </div>

      <div className="space-y-4">
        <TextField
          label={t('Short name')}
          isRequired
          value={phase.name ?? ''}
          onChange={(value) => updatePhase({ name: value })}
          onBlur={() => markTouched('name')}
          errorMessage={getErrorMessage('name')}
          description={t(
            'A short name for you to easily recognize the purpose of the phase. This is not viewable to participants.',
          )}
          maxLength={50}
        />
        <TextField
          label={t('Headline')}
          isRequired
          value={phase.headline ?? ''}
          onChange={(value) => updatePhase({ headline: value })}
          onBlur={() => markTouched('headline')}
          errorMessage={getErrorMessage('headline')}
          description={t('This text appears as the header of the page.')}
          maxLength={50}
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
          maxLength={250}
        />
        <div className="space-y-2">
          <label className="block text-sm">{t('Additional information')}</label>
          <RichTextEditorWithToolbar
            content={phase.additionalInfo ?? ''}
            onChange={(content) => updatePhase({ additionalInfo: content })}
            toolbarPosition="bottom"
            className="rounded-lg border border-border"
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
              value={safeParseLocal(phase.startDate)}
              maxValue={safeParseLocal(phase.endDate)}
              onChange={(date) =>
                updatePhase({ startDate: formatDateValue(date) })
              }
            />
          </div>
          <div className="flex-1" onBlur={() => markTouched('endDate')}>
            <DatePicker
              label={t('End date')}
              isRequired
              value={safeParseLocal(phase.endDate)}
              minValue={safeParseLocal(phase.startDate)}
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
      <div className="space-y-2">
        <ToggleRow
          label={t('Proposal submission')}
          description={t(
            'Participants can submit new proposals during this phase.',
          )}
        >
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
        <ToggleRow
          label={t('Proposal editing')}
          description={t('Authors can edit their proposals after submitting')}
        >
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
        <ToggleRow
          label={t('Proposal review')}
          description={t(
            'Proposals can be assessed and scored during this phase.',
          )}
        >
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
        <ToggleRow
          label={t('Voting')}
          description={t(
            'Participants can vote on proposals during this phase.',
          )}
        >
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
