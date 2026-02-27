'use client';

import { trpc } from '@op/api/client';
import type { RubricTemplateSchema } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { Accordion } from '@op/ui/Accordion';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import type { Key } from '@op/ui/RAC';
import { Sortable } from '@op/ui/Sortable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuLeaf, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type {
  CriterionView,
  RubricCriterionType,
} from '../../../../decisions/rubricTemplate';
import {
  addCriterion,
  changeCriterionType,
  createEmptyRubricTemplate,
  getCriteria,
  getCriterion,
  getCriterionErrors,
  removeCriterion,
  reorderCriteria,
  setCriterionRequired,
  updateCriterionDescription,
  updateCriterionJsonSchema,
  updateCriterionLabel,
  updateScoreLabel,
  updateScoredMaxPoints,
} from '../../../../decisions/rubricTemplate';
import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
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
  const isDraft = instance.status === 'draft';
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
  const hasUserEditedRef = useRef(false);

  // Validation: "show on blur, clear on change"
  const [criterionErrors, setCriterionErrors] = useState<Map<string, string[]>>(
    new Map(),
  );

  // Accordion expansion state
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(new Set());

  const setRubricTemplateSchema = useProcessBuilderStore(
    (s) => s.setRubricTemplateSchema,
  );
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

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

  // Debounced auto-save
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

  // Trigger debounced save when template changes.
  // Only saves after a user-initiated edit — not on initial load or when
  // the debounced callback reference changes.
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!hasUserEditedRef.current) {
      return;
    }

    setSaveStatus(decisionProfileId, 'saving');
    debouncedSave(template);
  }, [template, decisionProfileId, setSaveStatus, debouncedSave]);

  // --- Handlers ---

  /** Mark as user-edited and update template state. */
  const editTemplate = useCallback(
    (updater: (prev: RubricTemplateSchema) => RubricTemplateSchema) => {
      hasUserEditedRef.current = true;
      setTemplate(updater);
    },
    [],
  );

  const handleAddCriterion = useCallback(() => {
    const criterionId = crypto.randomUUID().slice(0, 8);
    const label = t('New criterion');
    editTemplate((prev) => addCriterion(prev, criterionId, 'scored', label));
    setExpandedKeys((prev) => new Set([...prev, criterionId]));
  }, [t, editTemplate]);

  const handleRemoveCriterion = useCallback(
    (criterionId: string) => {
      editTemplate((prev) => removeCriterion(prev, criterionId));
      setCriterionErrors((prev) => {
        const next = new Map(prev);
        next.delete(criterionId);
        return next;
      });
    },
    [editTemplate],
  );

  const handleReorderCriteria = useCallback(
    (newItems: CriterionView[]) => {
      editTemplate((prev) =>
        reorderCriteria(
          prev,
          newItems.map((item) => item.id),
        ),
      );
    },
    [editTemplate],
  );

  const handleUpdateLabel = useCallback(
    (criterionId: string, label: string) => {
      editTemplate((prev) => updateCriterionLabel(prev, criterionId, label));
    },
    [editTemplate],
  );

  const handleUpdateDescription = useCallback(
    (criterionId: string, description: string) => {
      editTemplate((prev) =>
        updateCriterionDescription(prev, criterionId, description || undefined),
      );
    },
    [editTemplate],
  );

  const handleUpdateRequired = useCallback(
    (criterionId: string, required: boolean) => {
      editTemplate((prev) => setCriterionRequired(prev, criterionId, required));
    },
    [editTemplate],
  );

  const handleChangeType = useCallback(
    (criterionId: string, newType: RubricCriterionType) => {
      editTemplate((prev) => changeCriterionType(prev, criterionId, newType));
    },
    [editTemplate],
  );

  const handleUpdateJsonSchema = useCallback(
    (criterionId: string, updates: Record<string, unknown>) => {
      editTemplate((prev) =>
        updateCriterionJsonSchema(prev, criterionId, updates),
      );
    },
    [editTemplate],
  );

  const handleUpdateMaxPoints = useCallback(
    (criterionId: string, maxPoints: number) => {
      editTemplate((prev) =>
        updateScoredMaxPoints(prev, criterionId, maxPoints),
      );
    },
    [editTemplate],
  );

  const handleUpdateScoreLabel = useCallback(
    (criterionId: string, scoreIndex: number, label: string) => {
      editTemplate((prev) =>
        updateScoreLabel(prev, criterionId, scoreIndex, label),
      );
    },
    [editTemplate],
  );

  const handleCriterionBlur = useCallback(
    (criterionId: string) => {
      const criterion = getCriterion(template, criterionId);
      if (criterion) {
        setCriterionErrors((prev) =>
          new Map(prev).set(criterionId, getCriterionErrors(criterion)),
        );
      }
    },
    [template],
  );

  return (
    <div className="flex h-full flex-col md:flex-row">
      <main className="flex-1 basis-1/2 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
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
                variant="unstyled"
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
                    const criterion = items[0];
                    if (!criterion) {
                      return null;
                    }
                    return <RubricCriterionDragPreview criterion={criterion} />;
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
                        key={criterion.id}
                        criterion={criterion}
                        errors={displayedErrors}
                        controls={controls}
                        onRemove={handleRemoveCriterion}
                        onBlur={handleCriterionBlur}
                        onUpdateLabel={handleUpdateLabel}
                        onUpdateDescription={handleUpdateDescription}
                        onUpdateRequired={handleUpdateRequired}
                        onChangeType={handleChangeType}
                        onUpdateJsonSchema={handleUpdateJsonSchema}
                        onUpdateMaxPoints={handleUpdateMaxPoints}
                        onUpdateScoreLabel={handleUpdateScoreLabel}
                      />
                    );
                  }}
                </Sortable>
              </Accordion>

              <Button
                color="secondary"
                className="w-full text-primary-teal hover:text-primary-tealBlack"
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
