'use client';

import { trpc } from '@op/api/client';
import type { RubricTemplateSchema } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import { Sortable } from '@op/ui/Sortable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuLeaf, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/routing';

import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
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

export function RubricEditorContent({
  instanceId,
  decisionProfileId,
}: SectionProps) {
  const t = useTranslations();

  const storeRubricTemplate = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId]?.rubricTemplate,
  );

  // Load instance data from the backend
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instanceData = instance.instanceData;

  const initialTemplate = useMemo(() => {
    const saved = storeRubricTemplate ?? instanceData?.rubricTemplate;
    if (saved && Object.keys(saved.properties ?? {}).length > 0) {
      return saved as RubricTemplateSchema;
    }
    return createEmptyRubricTemplate();
  }, [storeRubricTemplate, instanceData?.rubricTemplate]);

  const [template, setTemplate] =
    useState<RubricTemplateSchema>(initialTemplate);
  const isInitialLoadRef = useRef(true);

  // Validation: "show on blur, clear on change"
  const [criterionErrors, setCriterionErrors] = useState<
    Map<string, TranslationKey[]>
  >(new Map());

  // Track which criteria are expanded — multiple can be open simultaneously
  const [expandedCriterionIds, setExpandedCriterionIds] = useState<Set<string>>(
    new Set(),
  );

  // Track newly added criteria for highlight animation
  const [newCriterionIds, setNewCriterionIds] = useState<Set<string>>(
    new Set(),
  );

  // Cache scored config so switching type and back doesn't lose score labels
  const scoredConfigCacheRef = useRef<
    Map<string, { maximum: number; oneOf: { const: number; title: string }[] }>
  >(new Map());

  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  // Derive criterion views from the template
  const criteria = useMemo(() => getCriteria(template), [template]);

  // Save rubric changes via the shared autosave context (skip initial load)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    saveChanges({ rubricTemplate: template });
  }, [template]);

  // --- Handlers ---

  const handleAddCriterion = useCallback(() => {
    const criterionId = crypto.randomUUID().slice(0, 8);
    const label = t('Untitled field');
    setTemplate((prev) => addCriterion(prev, criterionId, 'scored', label));
    setExpandedCriterionIds((prev) => new Set(prev).add(criterionId));
    setNewCriterionIds((prev) => new Set(prev).add(criterionId));
  }, [t]);

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

  const handleCriterionBlur = useCallback(
    (criterionId: string) => {
      const criterion = criteria.find((c) => c.id === criterionId);
      if (criterion) {
        setCriterionErrors((prev) =>
          new Map(prev).set(criterionId, getCriterionErrors(criterion)),
        );
      }
    },
    [criteria],
  );

  const handleNewComplete = useCallback((criterionId: string) => {
    setNewCriterionIds((prev) => {
      const next = new Set(prev);
      next.delete(criterionId);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <main className="flex-1 basis-1/2 overflow-y-auto p-4 pb-24 [scrollbar-gutter:stable] md:p-8 md:pb-8">
        <div className="mx-auto max-w-160 space-y-4">
          <div className="flex items-center justify-between">
            <Header2 className="font-serif text-title-sm">
              {t('Review Criteria')}
            </Header2>
            <SaveStatusIndicator
              status={autosaveStatus.status}
              savedAt={autosaveStatus.savedAt}
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
                  return <RubricCriterionDragPreview criterion={item} />;
                }}
                renderDropIndicator={RubricCriterionDropIndicator}
                aria-label={t('Rubric criteria')}
              >
                {(criterion, controls) => {
                  const snapshotErrors =
                    criterionErrors.get(criterion.id) ?? [];
                  const liveErrors = getCriterionErrors(criterion);
                  const displayedErrors = snapshotErrors.filter((e) =>
                    liveErrors.includes(e),
                  );

                  return (
                    <RubricCriterionCard
                      criterion={criterion}
                      errors={displayedErrors}
                      controls={controls}
                      isExpanded={expandedCriterionIds.has(criterion.id)}
                      onExpandedChange={(expanded) =>
                        setExpandedCriterionIds((prev) => {
                          const next = new Set(prev);
                          if (expanded) {
                            next.add(criterion.id);
                          } else {
                            next.delete(criterion.id);
                          }
                          return next;
                        })
                      }
                      isNew={newCriterionIds.has(criterion.id)}
                      onNewComplete={handleNewComplete}
                      onBlur={handleCriterionBlur}
                      onUpdateLabel={handleUpdateLabel}
                      onUpdateDescription={handleUpdateDescription}
                      onChangeType={handleChangeType}
                      onUpdateMaxPoints={handleUpdateMaxPoints}
                      onUpdateScoreLabel={handleUpdateScoreLabel}
                    />
                  );
                }}
              </Sortable>

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
    </div>
  );
}
