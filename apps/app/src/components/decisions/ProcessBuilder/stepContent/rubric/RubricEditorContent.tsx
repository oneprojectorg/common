'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import type { RubricTemplateSchema } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { Accordion, AccordionItem } from '@op/ui/Accordion';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import type { Key } from '@op/ui/RAC';
import { Sortable } from '@op/ui/Sortable';
import { cn } from '@op/ui/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuLeaf, LuPlus } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/routing';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';
import type {
  CriterionView,
  RubricCriterionType,
} from '@/components/decisions/rubricTemplate';
import {
  addCriterion,
  changeCriterionType,
  createEmptyRubricTemplate,
  getCriteria,
  getCriterionErrors,
  getCriterionSchema,
  getCriterionType,
  removeCriterion,
  reorderCriteria,
  updateCriterionDescription,
  updateCriterionJsonSchema,
  updateCriterionLabel,
  updateScoreLabel,
  updateScoredMaxPoints,
} from '@/components/decisions/rubricTemplate';

import {
  RubricCriterionCard,
  RubricCriterionDragPreview,
  RubricCriterionDropIndicator,
} from './RubricCriterionCard';
import { RubricParticipantPreview } from './RubricParticipantPreview';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function RubricEditorContent({
  decisionProfileId,
  instanceId,
}: SectionProps) {
  const t = useTranslations();

  // Load instance data from the backend
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const isDraft = instance.status === ProcessStatus.DRAFT;
  const utils = trpc.useUtils();
  const instanceData = instance.instanceData;

  const initialTemplate = useMemo(() => {
    const saved = instanceData?.rubricTemplate;
    if (saved && Object.keys(saved.properties ?? {}).length > 0) {
      return saved as RubricTemplateSchema;
    }
    return createEmptyRubricTemplate();
  }, [instanceData?.rubricTemplate]);

  const [template, setTemplate] =
    useState<RubricTemplateSchema>(initialTemplate);
  const isInitialLoadRef = useRef(true);

  // Validation: "show on blur, clear on change"
  const [criterionErrors, setCriterionErrors] = useState<
    Map<string, TranslationKey[]>
  >(new Map());

  // Accordion expansion state
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());

  // Delete confirmation modal
  const [criterionToDelete, setCriterionToDelete] = useState<string | null>(
    null,
  );

  // Cache scored config so switching type and back doesn't lose score labels
  const scoredConfigCacheRef = useRef<
    Map<string, { maximum: number; oneOf: { const: number; title: string }[] }>
  >(new Map());

  const { setRubricTemplateSchema, setSaveStatus, markSaved, getSaveState } =
    useProcessBuilderStore(
      useShallow((s) => ({
        setRubricTemplateSchema: s.setRubricTemplateSchema,
        setSaveStatus: s.setSaveStatus,
        markSaved: s.markSaved,
        getSaveState: s.getSaveState,
      })),
    );
  const saveState = getSaveState(decisionProfileId);

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

  // Derive criterion views from the template
  const criteria = useMemo(() => getCriteria(template), [template]);
  const criteriaIndexMap = useMemo(
    () => new Map(criteria.map((c, i) => [c.id, i])),
    [criteria],
  );

  // TODO: Extract this debounced auto-save pattern into a shared useAutoSave() hook
  // (same pattern is used in TemplateEditorContent and useProposalDraft)
  const debouncedSave = useDebouncedCallback(
    (updatedTemplate: RubricTemplateSchema) => {
      setRubricTemplateSchema(decisionProfileId, updatedTemplate);

      if (isDraft) {
        updateInstance.mutate({
          instanceId,
          rubricTemplate: updatedTemplate,
        });
      } else {
        markSaved(decisionProfileId);
      }
    },
    AUTOSAVE_DEBOUNCE_MS,
  );
  debouncedSaveRef.current = () => debouncedSave.isPending();

  // Trigger debounced save when template changes (skip initial load)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    setSaveStatus(decisionProfileId, 'saving');
    debouncedSave(template);
  }, [template, decisionProfileId, setSaveStatus, debouncedSave]);

  // --- Handlers ---

  const handleAddCriterion = useCallback(() => {
    const criterionId = crypto.randomUUID().slice(0, 8);
    const label = t('New criterion');
    setTemplate((prev) => addCriterion(prev, criterionId, 'scored', label));
    setExpandedKeys((prev) => new Set([...prev, criterionId]));
  }, [t]);

  const handleRemoveCriterion = useCallback((criterionId: string) => {
    setCriterionToDelete(criterionId);
  }, []);

  const confirmRemoveCriterion = useCallback(() => {
    if (!criterionToDelete) {
      return;
    }
    setTemplate((prev) => removeCriterion(prev, criterionToDelete));
    setCriterionErrors((prev) => {
      const next = new Map(prev);
      next.delete(criterionToDelete);
      return next;
    });
    scoredConfigCacheRef.current.delete(criterionToDelete);
    setCriterionToDelete(null);
  }, [criterionToDelete]);

  const handleReorderCriteria = useCallback((newItems: CriterionView[]) => {
    setTemplate((prev) =>
      reorderCriteria(
        prev,
        newItems.map((item) => item.id),
      ),
    );
  }, []);

  const handleUpdateLabel = useCallback(
    (criterionId: string, label: string) => {
      setTemplate((prev) => updateCriterionLabel(prev, criterionId, label));
    },
    [],
  );

  const handleUpdateDescription = useCallback(
    (criterionId: string, description: string) => {
      setTemplate((prev) =>
        updateCriterionDescription(prev, criterionId, description || undefined),
      );
    },
    [],
  );

  const handleChangeType = useCallback(
    (criterionId: string, newType: RubricCriterionType) => {
      setTemplate((prev) => {
        // Stash scored config before switching away from scored
        if (getCriterionType(prev, criterionId) === 'scored') {
          const schema = getCriterionSchema(prev, criterionId);
          const oneOfEntries = (schema?.oneOf ?? []).filter(
            (e): e is { const: number; title: string } =>
              typeof e === 'object' &&
              e !== null &&
              'const' in e &&
              typeof (e as Record<string, unknown>).const === 'number' &&
              'title' in e &&
              typeof (e as Record<string, unknown>).title === 'string',
          );
          scoredConfigCacheRef.current.set(criterionId, {
            maximum: schema?.maximum ?? 5,
            oneOf: oneOfEntries,
          });
        }

        // Change the type (rebuilds schema from scratch)
        let updated = changeCriterionType(prev, criterionId, newType);

        // Restore cached scored config when switching back to scored
        if (newType === 'scored') {
          const cached = scoredConfigCacheRef.current.get(criterionId);
          if (cached) {
            updated = updateCriterionJsonSchema(updated, criterionId, {
              maximum: cached.maximum,
              oneOf: cached.oneOf,
            });
          }
        }

        return updated;
      });
    },
    [],
  );

  const handleUpdateMaxPoints = useCallback(
    (criterionId: string, maxPoints: number) => {
      setTemplate((prev) =>
        updateScoredMaxPoints(prev, criterionId, maxPoints),
      );
    },
    [],
  );

  const handleUpdateScoreLabel = useCallback(
    (criterionId: string, scoreValue: number, label: string) => {
      setTemplate((prev) =>
        updateScoreLabel(prev, criterionId, scoreValue, label),
      );
    },
    [],
  );

  return (
    <div className="flex h-full flex-col md:flex-row">
      <main className="flex-1 basis-1/2 overflow-y-auto p-4 pb-24 [scrollbar-gutter:stable] md:p-8 md:pb-8">
        <div className="mx-auto max-w-160 space-y-4">
          <div className="flex items-center justify-between">
            <Header2 className="font-serif text-title-sm">
              {t('Review Criteria')}
            </Header2>
            <SaveStatusIndicator
              status={saveState.status}
              savedAt={saveState.savedAt}
            />
          </div>

          {criteria.length === 0 ? (
            <div className="rounded-lg border p-16">
              <EmptyState icon={<LuLeaf className="size-5" />}>
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="font-medium text-neutral-charcoal">
                    {t('No review criteria yet')}
                  </span>
                  <span>
                    {t(
                      'Add criteria to help reviewers evaluate proposals consistently',
                    )}
                  </span>
                  <Button
                    color="primary"
                    className="mt-2"
                    onPress={handleAddCriterion}
                  >
                    <LuPlus className="size-4" />
                    {t('Add your first criterion')}
                  </Button>
                </div>
              </EmptyState>
            </div>
          ) : (
            <>
              <Accordion
                allowsMultipleExpanded
                expandedKeys={expandedKeys}
                onExpandedChange={setExpandedKeys}
              >
                <Sortable
                  items={criteria}
                  onChange={handleReorderCriteria}
                  dragTrigger="handle"
                  getItemLabel={(criterion) => criterion.label}
                  className="gap-3"
                  renderDragPreview={(items) => {
                    const item = items[0];
                    if (!item) {
                      return null;
                    }
                    const idx = criteriaIndexMap.get(item.id) ?? 0;
                    return (
                      <RubricCriterionDragPreview
                        criterion={item}
                        index={idx + 1}
                      />
                    );
                  }}
                  renderDropIndicator={RubricCriterionDropIndicator}
                  aria-label={t('Rubric criteria')}
                >
                  {(criterion, controls) => {
                    const idx = criteriaIndexMap.get(criterion.id) ?? 0;
                    const snapshotErrors =
                      criterionErrors.get(criterion.id) ?? [];
                    const liveErrors = getCriterionErrors(criterion);
                    const displayedErrors = snapshotErrors.filter((e) =>
                      liveErrors.includes(e),
                    );

                    return (
                      <AccordionItem
                        id={criterion.id}
                        variant="unstyled"
                        className={cn(
                          'rounded-lg border bg-white',
                          controls.isDragging && 'opacity-50',
                        )}
                      >
                        <RubricCriterionCard
                          criterion={criterion}
                          index={idx + 1}
                          errors={displayedErrors}
                          controls={controls}
                          onRemove={handleRemoveCriterion}
                          onUpdateLabel={handleUpdateLabel}
                          onUpdateDescription={handleUpdateDescription}
                          onChangeType={handleChangeType}
                          onUpdateMaxPoints={handleUpdateMaxPoints}
                          onUpdateScoreLabel={handleUpdateScoreLabel}
                        />
                      </AccordionItem>
                    );
                  }}
                </Sortable>
              </Accordion>

              <Button
                color="secondary"
                className="w-full"
                onPress={handleAddCriterion}
              >
                <LuPlus className="size-4" />
                {t('Add criterion')}
              </Button>
            </>
          )}
        </div>
      </main>

      <RubricParticipantPreview template={template} />

      <ConfirmDeleteModal
        isOpen={criterionToDelete !== null}
        title={t('Delete criterion')}
        message={t(
          'Are you sure you want to delete this criterion? This action cannot be undone.',
        )}
        onConfirm={confirmRemoveCriterion}
        onCancel={() => setCriterionToDelete(null)}
      />
    </div>
  );
}
