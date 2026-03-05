'use client';

import { trpc } from '@op/api/client';
import type { PhaseDefinition } from '@op/api/encoders';
import { useDebouncedCallback } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { cn } from '@op/ui/utils';
import { useRef, useState } from 'react';
import {
  LuCheck,
  LuChevronRight,
  LuGripVertical,
  LuPlus,
  LuTrash2,
} from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { phaseToSectionId } from '../../navigationConfig';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { useProcessNavigation } from '../../useProcessNavigation';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function PhasesSectionContent({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instancePhases = instance.instanceData?.phases;
  const templatePhases = instance.process?.processSchema?.phases;
  const isDraft = instance.status === ProcessStatus.DRAFT;

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

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
  const { setSection } = useProcessNavigation();

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

    setInstanceData(decisionProfileId, { phases: phasesPayload });

    if (isDraft) {
      updateInstance.mutate({ instanceId, phases: phasesPayload });
    } else {
      markSaved(decisionProfileId);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
  debouncedSaveRef.current = () => debouncedSave.isPending();

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

  const addPhase = () => {
    const newPhase: PhaseDefinition = {
      id: crypto.randomUUID().slice(0, 8),
      name: t('New phase'),
      rules: {},
    };
    const updated = [...phases, newPhase];
    setPhases(updated);
    debouncedSave(updated);
    setSection(phaseToSectionId(newPhase.id));
  };

  const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null);

  const confirmRemovePhase = () => {
    if (!phaseToDelete) {
      return;
    }
    updatePhases((prev) => prev.filter((p) => p.id !== phaseToDelete));
    setPhaseToDelete(null);
  };

  /** Check if a phase has its required fields filled in */
  const isPhaseConfigured = (phase: PhaseDefinition) => {
    return !!(
      phase.name?.trim() &&
      phase.headline?.trim() &&
      phase.description?.trim() &&
      phase.endDate
    );
  };

  return (
    <div className="mx-auto w-full space-y-4 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
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

      {phases.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          <Sortable
            items={phases}
            onChange={updatePhases}
            dragTrigger="handle"
            getItemLabel={(phase) => phase.name}
            className="gap-2"
            renderDragPreview={(items) => (
              <PhaseDragPreview name={items[0]?.name} />
            )}
            renderDropIndicator={PhaseDropIndicator}
          >
            {(phase, { dragHandleProps, isDragging }) => {
              const configured = isPhaseConfigured(phase);
              return (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-lg border bg-white px-3 py-3',
                    isDragging && 'opacity-50',
                  )}
                >
                  <DragHandle {...dragHandleProps} />
                  <button
                    type="button"
                    className="flex flex-1 cursor-pointer items-center gap-3"
                    onClick={() => setSection(phaseToSectionId(phase.id))}
                  >
                    <div className="flex-1 text-left">
                      <p className="font-serif text-title-sm">{phase.name}</p>
                      {configured ? (
                        <span className="flex items-center gap-1 text-xs text-primary-teal">
                          <LuCheck className="size-3" />
                          {t('Configured')}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-gray4">
                          {t('Not configured yet')}
                        </span>
                      )}
                    </div>
                    <LuChevronRight className="size-4 text-neutral-gray4" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-neutral-gray4 hover:text-functional-red"
                    onClick={() => setPhaseToDelete(phase.id)}
                    aria-label={t('Delete phase')}
                  >
                    <LuTrash2 className="size-4" />
                  </button>
                </div>
              );
            }}
          </Sortable>
          <Button
            color="secondary"
            className="w-full text-primary-teal hover:text-primary-tealBlack"
            onPress={addPhase}
          >
            <LuPlus className="size-4" />
            {t('Add phase')}
          </Button>
        </div>
      )}

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
}

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
