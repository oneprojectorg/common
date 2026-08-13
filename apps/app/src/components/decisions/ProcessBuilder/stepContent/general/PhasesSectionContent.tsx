'use client';

import { trpc } from '@op/api/client';
import type { PhaseDefinition } from '@op/api/encoders';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import { Header1 } from '@op/sense/Header';
import { DragHandle, Sortable } from '@op/sense/Sortable';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useQueryState } from 'nuqs';
import { useMemo, useState } from 'react';
import { LuCheck, LuCircleAlert, LuPlus, LuTrash2 } from 'react-icons/lu';

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
  const locale = useLocale();
  const [, setSectionParam] = useQueryState('section', { history: 'push' });
  const setSection = (sectionId: string) => setSectionParam(sectionId);

  // "Jan 15 – Feb 15" for a configured phase — formatRange handles locale,
  // same-month collapsing, and RTL; falls back to the end date alone.
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  );
  const phaseDateRange = (phase: PhaseDefinition): string | null => {
    if (!phase.endDate) {
      return null;
    }
    const end = new Date(phase.endDate);
    if (phase.startDate) {
      const start = new Date(phase.startDate);
      if (start.getTime() <= end.getTime()) {
        return dateFormat.formatRange(start, end);
      }
    }
    return dateFormat.format(end);
  };

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
    <div className="mx-auto w-full space-y-2 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="flex items-center justify-between">
        <Header1 className="text-headline">{t('Phases')}</Header1>
        <SaveStatusIndicator
          status={autosaveStatus.status}
          savedAt={autosaveStatus.savedAt}
        />
      </div>
      <p className="mb-10 text-muted-foreground">
        {t(
          'Arrange the stages of your decision process. Drag to reorder, click to configure.',
        )}
      </p>

      {phases.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-input p-8 text-center">
            <p className="text-muted-foreground">{t('No phases defined')}</p>
          </div>
          <Button
            variant="ghost"
            className="text-primary hover:text-teal-600"
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
            className="gap-4"
            renderDragPreview={(items) => {
              const phase = items[0];
              if (!phase) {
                return null;
              }
              return (
                <PhaseDragPreview
                  phase={phase}
                  configured={isPhaseConfigured(phase)}
                  dateRange={phaseDateRange(phase)}
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
                      <p className="font-serif text-label">{phase.name}</p>
                      {configured ? (
                        <span className="flex items-center gap-1 text-sm text-primary">
                          <LuCheck className="size-3" />
                          {phaseDateRange(phase)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
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
                        {configured ? t('Edit') : t('Configure')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
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
          <Button variant="outline" className="w-full" onClick={addPhase}>
            <LuPlus className="size-4" />
            {t('Add phase')}
          </Button>
        </div>
      )}

      <AlertDialog
        open={phaseToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPhaseToDelete(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-50">
              <LuCircleAlert className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('Delete phase?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to delete this phase? This action cannot be undone.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmRemovePhase}
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Element to show when a phase is being dragged */
const PhaseDragPreview = ({
  phase,
  configured,
  dateRange,
  t,
}: {
  phase: PhaseDefinition;
  configured: boolean;
  dateRange: string | null;
  t: TranslateFn;
}) => {
  return (
    <div
      aria-hidden
      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-3 shadow-md"
    >
      <DragHandle tabIndex={-1} aria-hidden />
      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="flex-1">
          <p className="font-serif text-label">{phase.name}</p>
          {configured ? (
            <span className="flex items-center gap-1 text-sm text-primary">
              <LuCheck className="size-3" />
              {dateRange}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t('Not configured yet')}
            </span>
          )}
        </div>
        {/* Inert placeholders — this is the drag ghost, so no handlers and
            no tab stops (aria-hidden on the wrapper below). */}
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" size="sm" tabIndex={-1}>
            {configured ? t('Edit') : t('Configure')}
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            tabIndex={-1}
            aria-label={t('Delete phase?')}
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
