'use client';

import { trpc } from '@op/api/client';
import { SYSTEM_FIELD_KEYS } from '@op/common/client';
import type {
  ProposalTemplateSchema,
  XFormatPropertySchema,
} from '@op/common/client';
import { Button } from '@op/sense/Button';
import { CollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import { Header2 } from '@op/sense/Header';
import { Sortable } from '@op/sense/Sortable';
import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';
import {
  type FieldType,
  type FieldView,
  LOCATION_FIELD_KEY,
  addField as addFieldToTemplate,
  changeFieldType,
  createDefaultTemplate,
  ensureLockedFields,
  getField,
  getFieldErrors,
  getFieldSchema,
  getFields,
  removeField as removeFieldFromTemplate,
  reorderFields as reorderTemplateFields,
  setFieldRequired,
  updateFieldDescription,
  updateFieldLabel,
} from '@/components/decisions/proposalTemplate';

import { AddFieldMenu } from './AddFieldMenu';
import { BudgetFieldConfig } from './BudgetFieldConfig';
import {
  FieldCard,
  FieldCardDragPreview,
  FieldCardDropIndicator,
} from './FieldCard';
import { getFieldLabelKey } from './fieldRegistry';

export function TemplateEditorContent({
  decisionProfileId,
  instanceId,
}: SectionProps) {
  const t = useTranslations();
  const [, setStep] = useQueryState('step', { history: 'push' });
  const [, setSection] = useQueryState('section', { history: 'push' });

  // Load instance data from the backend
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const instanceData = instance.instanceData;

  const storeData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const rawCategories =
    storeData?.config?.categories ?? instanceData?.config?.categories;
  const categories = useMemo(() => rawCategories ?? [], [rawCategories]);
  const requireCategorySelection =
    storeData?.config?.requireCategorySelection ??
    instanceData?.config?.requireCategorySelection ??
    false;
  const allowMultipleCategories =
    storeData?.config?.allowMultipleCategories ??
    instanceData?.config?.allowMultipleCategories ??
    false;
  const hasCategories = categories.length > 0;

  const initialTemplate = useMemo(() => {
    const saved = storeData?.proposalTemplate ?? instanceData?.proposalTemplate;

    const base =
      saved && Object.keys(saved.properties ?? {}).length > 0
        ? saved
        : createDefaultTemplate(t('Proposal summary'), t('Proposal title'));

    // Ensure locked system fields are present (backward compat)
    return ensureLockedFields(base, {
      titleLabel: t('Proposal title'),
      categoryLabel: t('Category'),
      categories,
      allowMultipleCategories,
      requireCategorySelection,
    });
  }, [
    storeData?.proposalTemplate,
    instanceData?.proposalTemplate,
    categories,
    allowMultipleCategories,
    requireCategorySelection,
  ]);

  const [template, setTemplate] =
    useState<ProposalTemplateSchema>(initialTemplate);

  // Track which fields are expanded — multiple can be open simultaneously
  const [expandedFieldIds, setExpandedFieldIds] = useState<Set<string>>(
    new Set(),
  );

  // Track newly added fields for the teal border highlight animation
  const [newFieldIds, setNewFieldIds] = useState<Set<string>>(new Set());

  // Delete confirmation modal
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  // Keep locked fields (category) in sync when the upstream config changes
  // (e.g. categories added/removed in the Proposal Categories step).
  // Applied to the current template state so user edits are preserved.
  const categorySyncedRef = useRef(false);
  useEffect(() => {
    if (!categorySyncedRef.current) {
      categorySyncedRef.current = true;
      return;
    }
    setTemplate((prev) =>
      ensureLockedFields(prev, {
        titleLabel: t('Proposal title'),
        categoryLabel: t('Category'),
        categories,
        allowMultipleCategories,
        requireCategorySelection,
      }),
    );
  }, [categories, allowMultipleCategories, requireCategorySelection]);

  // "Show on blur, clear on change" validation: errors are snapshotted when
  // a field card loses focus, but resolved errors disappear immediately
  // while editing (see renderFieldCard intersection logic).
  const [fieldErrors, setFieldErrors] = useState<Map<string, string[]>>(
    new Map(),
  );

  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  // Derive field views from the template, excluding locked system fields
  // that are always rendered separately above the sortable list.
  const fields = useMemo(
    () => getFields(template).filter((f) => !SYSTEM_FIELD_KEYS.has(f.id)),
    [template],
  );

  // Single-instance field types that can't be added again. Location uses a
  // fixed key, so a second one would overwrite the first.
  const disabledTypes = useMemo<FieldType[]>(
    () => (getFieldSchema(template, LOCATION_FIELD_KEY) ? ['location'] : []),
    [template],
  );

  // Save template changes via the shared autosave context.
  // Runs ensureLockedFields before persisting so that x-field-order and
  // required are always consistent.
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const normalized = ensureLockedFields(template, {
      titleLabel: t('Proposal title'),
      categoryLabel: t('Category'),
      categories,
      allowMultipleCategories,
      requireCategorySelection,
    });
    saveChanges({ proposalTemplate: normalized });
  }, [template]);

  const handleAddField = useCallback(
    (type: FieldType) => {
      // The menu disables a single-instance type once the template has one;
      // this is defense in depth. Adding a second location would reuse the
      // fixed key and overwrite the first, losing its saved map view.
      if (disabledTypes.includes(type)) {
        return;
      }
      // Location uses a fixed key (single instance, projected to a geometry
      // column server-side) and is always required.
      const fieldId =
        type === 'location'
          ? LOCATION_FIELD_KEY
          : crypto.randomUUID().slice(0, 8);
      const label = t(getFieldLabelKey(type));
      setTemplate((prev) => {
        const next = addFieldToTemplate(prev, fieldId, type, label);
        return type === 'location'
          ? setFieldRequired(next, fieldId, true)
          : next;
      });
      // Auto-expand the newly added field and mark it as new
      setExpandedFieldIds((prev) => new Set(prev).add(fieldId));
      setNewFieldIds((prev) => new Set(prev).add(fieldId));
    },
    [t, disabledTypes],
  );

  const handleExpandedChange = useCallback(
    (fieldId: string, expanded: boolean) => {
      setExpandedFieldIds((prev) => {
        const next = new Set(prev);
        if (expanded) {
          next.add(fieldId);
        } else {
          next.delete(fieldId);
        }
        return next;
      });
    },
    [],
  );

  const handleNewComplete = useCallback((fieldId: string) => {
    setNewFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  }, []);

  const handleRemoveField = useCallback((fieldId: string) => {
    setFieldToDelete(fieldId);
  }, []);

  const confirmRemoveField = useCallback(() => {
    if (!fieldToDelete) {
      return;
    }
    setTemplate((prev) => removeFieldFromTemplate(prev, fieldToDelete));
    setFieldErrors((prev) => {
      const next = new Map(prev);
      next.delete(fieldToDelete);
      return next;
    });
    setExpandedFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(fieldToDelete);
      return next;
    });
    setNewFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(fieldToDelete);
      return next;
    });
    setFieldToDelete(null);
  }, [fieldToDelete]);

  const handleReorderFields = useCallback((newItems: FieldView[]) => {
    setTemplate((prev) =>
      reorderTemplateFields(
        prev,
        newItems.map((item) => item.id),
      ),
    );
  }, []);

  const handleUpdateLabel = useCallback((fieldId: string, label: string) => {
    setTemplate((prev) => updateFieldLabel(prev, fieldId, label));
  }, []);

  const handleUpdateDescription = useCallback(
    (fieldId: string, description: string) => {
      setTemplate((prev) =>
        updateFieldDescription(prev, fieldId, description || undefined),
      );
    },
    [],
  );

  const handleUpdateRequired = useCallback(
    (fieldId: string, required: boolean) => {
      // The location field is always required (its toggle is disabled)
      if (fieldId === LOCATION_FIELD_KEY) {
        return;
      }
      setTemplate((prev) => setFieldRequired(prev, fieldId, required));
    },
    [],
  );

  const handleFieldBlur = useCallback(
    (fieldId: string) => {
      const field = getField(template, fieldId);
      if (field) {
        setFieldErrors((prev) =>
          new Map(prev).set(fieldId, getFieldErrors(field)),
        );
      }
    },
    [template, allowMultipleCategories],
  );

  const handleUpdateJsonSchema = useCallback(
    (fieldId: string, updates: Partial<XFormatPropertySchema>) => {
      setTemplate((prev) => {
        const existing = getFieldSchema(prev, fieldId);
        if (!existing) {
          return prev;
        }
        return {
          ...prev,
          properties: {
            ...prev.properties,
            [fieldId]: { ...existing, ...updates },
          },
        };
      });
    },
    [],
  );

  const handleChangeFieldType = useCallback(
    (fieldId: string, newType: FieldType) => {
      // Location fields can't change type (and nothing can become one) —
      // the type selector is hidden for them, this is defense in depth.
      if (fieldId === LOCATION_FIELD_KEY || newType === 'location') {
        return;
      }
      setTemplate((prev) => changeFieldType(prev, fieldId, newType));
    },
    [],
  );

  /** Render a FieldCard for a given field view. */
  const renderFieldCard = (
    field: FieldView,
    controls: Parameters<Parameters<typeof Sortable>[0]['children']>[1],
  ) => {
    const snapshotErrors = fieldErrors.get(field.id) ?? [];
    const liveErrors = getFieldErrors(field);
    const displayedErrors = snapshotErrors.filter((e) =>
      liveErrors.includes(e),
    );

    return (
      <FieldCard
        key={field.id}
        field={field}
        fieldSchema={getFieldSchema(template, field.id) ?? {}}
        errors={displayedErrors}
        controls={controls}
        isExpanded={expandedFieldIds.has(field.id)}
        onExpandedChange={(expanded) =>
          handleExpandedChange(field.id, expanded)
        }
        isNew={newFieldIds.has(field.id)}
        onNewComplete={handleNewComplete}
        onRemove={handleRemoveField}
        onBlur={handleFieldBlur}
        onUpdateLabel={handleUpdateLabel}
        onUpdateDescription={handleUpdateDescription}
        onUpdateRequired={handleUpdateRequired}
        onUpdateJsonSchema={handleUpdateJsonSchema}
        onChangeFieldType={handleChangeFieldType}
      />
    );
  };

  return (
    <>
      <div>
        <div className="mx-auto w-full max-w-160 space-y-8 p-4 pb-24 md:p-8 md:pb-8">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Header2>{t('Proposal template')}</Header2>
              <div className="flex items-center gap-3">
                <SaveStatusIndicator
                  status={autosaveStatus.status}
                  savedAt={autosaveStatus.savedAt}
                />
              </div>
            </div>
            <p className="text-muted-foreground">
              {t('Build your proposal using the tools below')}
            </p>
          </div>
          {/* Locked system fields (stored in schema) */}
          <div className="space-y-4">
            <CollapsibleConfigCard
              label={t('Proposal title')}
              badgeLabel={t('Required')}
              locked
            />
            {hasCategories && (
              <CollapsibleConfigCard
                label={t('Category')}
                badgeLabel={
                  requireCategorySelection ? t('Required') : t('Optional')
                }
                locked
              >
                <div className="-mt-3 px-11 pb-4">
                  <p className="m-0 text-sm">
                    {t('These are the categories you defined in')}{' '}
                    <Button
                      variant="link"
                      size="inline"
                      className="inline text-sm underline"
                      onClick={() => {
                        void setStep('general');
                        void setSection('proposalCategories');
                      }}
                    >
                      {t('Proposal Categories')}
                    </Button>
                    .
                  </p>
                </div>
              </CollapsibleConfigCard>
            )}

            <BudgetFieldConfig
              template={template}
              onTemplateChange={setTemplate}
            />

            {/* Sortable fields */}
            <Sortable
              items={fields}
              onChange={handleReorderFields}
              dragTrigger="handle"
              getItemLabel={(field) => field.label}
              className="gap-3"
              renderDragPreview={(items) => {
                const field = items[0];
                if (!field) {
                  return null;
                }
                return <FieldCardDragPreview field={field} />;
              }}
              renderDropIndicator={FieldCardDropIndicator}
              aria-label={t('Form fields')}
            >
              {(field, controls) => renderFieldCard(field, controls)}
            </Sortable>
          </div>
          <AddFieldMenu
            onAddField={handleAddField}
            disabledTypes={disabledTypes}
          />
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={fieldToDelete !== null}
        title={t('Delete field')}
        message={t(
          'Are you sure you want to delete this field? This action cannot be undone.',
        )}
        onConfirm={confirmRemoveField}
        onCancel={() => setFieldToDelete(null)}
      />
    </>
  );
}
