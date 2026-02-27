'use client';

import { trpc } from '@op/api/client';
import type { RubricTemplateSchema } from '@op/common/client';
import { useDebouncedCallback } from '@op/hooks';
import { Accordion } from '@op/ui/Accordion';
import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import type { Key } from '@op/ui/RAC';
import { Sortable } from '@op/ui/Sortable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuPlus } from 'react-icons/lu';

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
    setTemplate((prev) => removeCriterion(prev, criterionId));
    setCriterionErrors((prev) => {
      const next = new Map(prev);
      next.delete(criterionId);
      return next;
    });
  }, []);

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

  const handleUpdateRequired = useCallback(
    (criterionId: string, required: boolean) => {
      setTemplate((prev) => setCriterionRequired(prev, criterionId, required));
    },
    [],
  );

  const handleChangeType = useCallback(
    (criterionId: string, newType: RubricCriterionType) => {
      setTemplate((prev) => changeCriterionType(prev, criterionId, newType));
    },
    [],
  );

  const handleUpdateJsonSchema = useCallback(
    (criterionId: string, updates: Record<string, unknown>) => {
      setTemplate((prev) =>
        updateCriterionJsonSchema(prev, criterionId, updates),
      );
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
    (criterionId: string, scoreIndex: number, label: string) => {
      setTemplate((prev) =>
        updateScoreLabel(prev, criterionId, scoreIndex, label),
      );
    },
    [],
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
              {t('Rubric criteria')}
            </Header2>
            <SaveStatusIndicator
              status={saveState.status}
              savedAt={saveState.savedAt}
            />
          </div>
          <p className="text-neutral-charcoal">
            {t('Define how reviewers will evaluate proposals')}
          </p>
          <hr />

          {criteria.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-gray3 p-8 text-center">
              <p className="text-neutral-gray4">{t('No criteria defined')}</p>
            </div>
          ) : (
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
          )}

          <Button
            color="secondary"
            className="w-full text-primary-teal hover:text-primary-tealBlack"
            onPress={handleAddCriterion}
          >
            <LuPlus className="size-4" />
            {t('Add criterion')}
          </Button>
        </div>
      </main>

      <RubricParticipantPreview template={template} />
    </div>
  );
}
