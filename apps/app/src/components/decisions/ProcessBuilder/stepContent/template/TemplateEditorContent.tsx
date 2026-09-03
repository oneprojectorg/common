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
import { LuPlus } from 'react-icons/lu';

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
  renameField,
  reorderFields as reorderTemplateFields,
  setFieldRequired,
  updateFieldDescription,
  updateFieldLabel,
} from '@/components/decisions/proposalTemplate';

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

  // Location is single-instance: it lives at a fixed key, so a second one
  // would overwrite the first. Once the template has one, every other card
  // stops offering the type (the location card keeps it so it reads as the
  // current selection).
  const hasLocationField = Boolean(
    getFieldSchema(template, LOCATION_FIELD_KEY),
  );
  const disabledTypes = useMemo<FieldType[]>(
    () => (hasLocationField ? ['location'] : []),
    [hasLocationField],
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
      const fieldId = createFieldId();
      const label = t(getFieldLabelKey(type));
      setTemplate((prev) => addFieldToTemplate(prev, fieldId, type, label));
      // Auto-expand the newly added field and mark it as new
      setExpandedFieldIds((prev) => new Set(prev).add(fieldId));
      setNewFieldIds((prev) => new Set(prev).add(fieldId));
    },
    [t],
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
      // The Type select disables a single-instance type once it's taken; this
      // is defense in depth. Retyping onto an occupied fixed key would
      // overwrite that field and lose its saved map view.
      if (fieldId !== LOCATION_FIELD_KEY && disabledTypes.includes(newType)) {
        return;
      }

      const nextFieldId = getFieldIdForType(fieldId, newType);

      setTemplate((prev) => {
        const retyped = changeFieldType(prev, fieldId, newType);
        const rekeyed =
          nextFieldId === fieldId
            ? retyped
            : renameField(retyped, fieldId, nextFieldId);

        // A template that collects a location always requires one — the
        // toggle is disabled on the card to match.
        return newType === 'location'
          ? setFieldRequired(rekeyed, nextFieldId, true)
          : rekeyed;
      });

      if (nextFieldId !== fieldId) {
        // Per-field UI state is keyed by field id, so it has to follow the
        // rekey or the card collapses and its errors detach mid-edit.
        setExpandedFieldIds((prev) => renameInSet(prev, fieldId, nextFieldId));
        setNewFieldIds((prev) => renameInSet(prev, fieldId, nextFieldId));
        setFieldErrors((prev) => renameInMap(prev, fieldId, nextFieldId));
      }
    },
    [disabledTypes],
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
        disabledTypes={
          field.id === LOCATION_FIELD_KEY ? EMPTY_FIELD_TYPES : disabledTypes
        }
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
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleAddField('short_text')}
          >
            <LuPlus className="size-4" />
            {t('Add field')}
          </Button>
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

/** Stable identity so a card without disabled types doesn't re-render. */
const EMPTY_FIELD_TYPES: FieldType[] = [];

function createFieldId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * The property key a field must use once it is a given type.
 *
 * A field becoming a location takes `LOCATION_FIELD_KEY`, and one leaving the
 * type hands it back and gets a fresh id. The CSV export addresses the
 * location field by that literal key rather than by its x-format — see
 * `renameField` for what breaks in each direction if the key doesn't follow.
 */
function getFieldIdForType(fieldId: string, type: FieldType): string {
  if (type === 'location') {
    return LOCATION_FIELD_KEY;
  }
  if (fieldId === LOCATION_FIELD_KEY) {
    return createFieldId();
  }
  return fieldId;
}

function renameInSet(
  ids: Set<string>,
  fromId: string,
  toId: string,
): Set<string> {
  if (!ids.has(fromId)) {
    return ids;
  }
  const next = new Set(ids);
  next.delete(fromId);
  next.add(toId);
  return next;
}

function renameInMap<T>(
  entries: Map<string, T>,
  fromId: string,
  toId: string,
): Map<string, T> {
  const value = entries.get(fromId);
  if (value === undefined) {
    return entries;
  }
  const next = new Map(entries);
  next.delete(fromId);
  next.set(toId, value);
  return next;
}
