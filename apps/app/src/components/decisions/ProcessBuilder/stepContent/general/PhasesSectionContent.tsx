'use client';

import { trpc } from '@op/api/client';
import type { PhaseDefinition } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Header2 } from '@op/sense/Header';
import { DragHandle, Sortable } from '@op/sense/Sortable';
import { cn } from '@op/sense/lib/utils';
import { useQueryState } from 'nuqs';
import { useState } from 'react';
import { LuCheck, LuPlus, LuTrash2 } from 'react-icons/lu';

import { type TranslateFn, useTranslations } from '@/lib/i18n';

import { useProcessBuilderAutosave } from '../../ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { phaseToSectionId } from '../../navigationConfig';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

export function PhasesSectionContent({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instancePhases = instance.instanceData?.phases;
  const templatePhases = instance.process?.processSchema?.phases;

  const storePhases = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.phases,
  );
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  const initialPhases: PhaseDefinition[] = (() => {
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
  const [phases, setPhases] = useState<PhaseDefinition[]>(initialPhases);
  const t = useTranslations();
  const [, setSectionParam] = useQueryState('section', { history: 'push' });
  const setSection = (sectionId: string) => setSectionParam(sectionId);

  const toPayload = (data: PhaseDefinition[]) =>
    data.map((phase) => ({
      phaseId: phase.id,
      name: phase.name,
      description: phase.description,
      headline: phase.headline,
      additionalInfo: phase.additionalInfo,
      startDate: phase.startDate,
      endDate: phase.endDate,
      rules: phase.rules,
    }));

  const savePhasesPayload = (data: PhaseDefinition[]) => {
    saveChanges({ phases: toPayload(data) });
  };

  const updatePhases = (
    updater:
      | PhaseDefinition[]
      | ((prev: PhaseDefinition[]) => PhaseDefinition[]),
  ) => {
    setPhases((prev) => {
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      savePhasesPayload(updated);
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
    savePhasesPayload(updated);
    setSection(phaseToSectionId(newPhase.id));
  };

  const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null);

  const confirmRemovePhase = () => {
    if (!phaseToDelete) {
      return;
    }
    const updated = phases.filter((p) => p.id !== phaseToDelete);
    setPhases(updated);
    savePhasesPayload(updated);
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
        <Header2 className="font-serif text-title-sm">{t('Phases')}</Header2>
        <SaveStatusIndicator
          status={autosaveStatus.status}
          savedAt={autosaveStatus.savedAt}
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
            variant="ghost"
            className="text-primary-teal hover:text-primary-tealBlack"
            onClick={addPhase}
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
            renderDragPreview={(items) => {
              const phase = items[0];
              if (!phase) {
                return null;
              }
              return (
                <PhaseDragPreview
                  phase={phase}
                  configured={isPhaseConfigured(phase)}
                  t={t}
                />
              );
            }}
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
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-serif text-title-sm">{phase.name}</p>
                      {configured ? (
                        <span className="flex items-center gap-1 text-sm text-primary-teal">
                          <LuCheck className="size-3" />
                          {t('Configured')}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-gray4">
                          {t('Not configured yet')}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSection(phaseToSectionId(phase.id))}
                      >
                        {t('Configure')}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="text-primary-teal hover:text-functional-red"
                        onClick={() => setPhaseToDelete(phase.id)}
                        aria-label={t('Delete phase?')}
                      >
                        <LuTrash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }}
          </Sortable>
          <Button
            variant="outline"
            className="w-full text-primary-teal hover:text-primary-tealBlack"
            onClick={addPhase}
          >
            <LuPlus className="size-4" />
            {t('Add phase')}
          </Button>
        </div>
      )}

      <Dialog
        open={phaseToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPhaseToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete phase?')}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p>
              {t(
                'Are you sure you want to delete this phase? This action cannot be undone.',
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="w-full sm:w-fit"
              onClick={() => setPhaseToDelete(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-fit"
              onClick={confirmRemovePhase}
            >
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Element to show when a phase is being dragged */
const PhaseDragPreview = ({
  phase,
  configured,
  t,
}: {
  phase: PhaseDefinition;
  configured: boolean;
  t: TranslateFn;
}) => {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-3 shadow-md">
      <DragHandle tabIndex={-1} aria-hidden />
      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="flex-1">
          <p className="font-serif text-title-sm">{phase.name}</p>
          {configured ? (
            <span className="flex items-center gap-1 text-sm text-primary-teal">
              <LuCheck className="size-3" />
              {t('Configured')}
            </span>
          ) : (
            <span className="text-sm text-neutral-gray4">
              {t('Not configured yet')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" size="sm">
            {t('Configure')}
          </Button>
          <Button
            aria-label={t('Delete phase')}
            variant="outline"
            size="icon-sm"
            className="text-primary-teal"
          >
            <LuTrash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

/** DropIndicator to show when a phase is being dragged */
const PhaseDropIndicator = ({
  children,
}: {
  item: PhaseDefinition;
  children: React.ReactNode;
}) => {
  return <div className="opacity-40">{children}</div>;
};
