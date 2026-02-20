'use client';

import { trpc } from '@op/api/client';
import { SYSTEM_FIELD_KEYS } from '@op/common/client';
import { useDebouncedCallback, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { FieldConfigCard } from '@op/ui/FieldConfigCard';
import { Header2 } from '@op/ui/Header';
import { SidebarProvider } from '@op/ui/Sidebar';
import { Sortable } from '@op/ui/Sortable';
import { useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuAlignLeft, LuChevronDown, LuHash } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalPropertySchema } from '../../../proposalEditor/compileProposalSchema';
import {
  type FieldType,
  type FieldView,
  type ProposalTemplate,
  addField as addFieldToTemplate,
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
} from '../../../proposalTemplate';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { AddFieldMenu } from './AddFieldMenu';
import { BudgetFieldConfig } from './BudgetFieldConfig';
import {
  FieldCard,
  FieldCardDragPreview,
  FieldCardDropIndicator,
} from './FieldCard';
import { ParticipantPreview } from './ParticipantPreview';
import {
  FieldListTrigger,
  TemplateEditorSidebar,
} from './TemplateEditorSidebar';
import { getFieldLabelKey } from './fieldRegistry';

const AUTOSAVE_DEBOUNCE_MS = 1000;

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

  // Check if categories have been configured and selection is required.
  // Read from the Zustand store first (written immediately by the categories
  // step), falling back to the server data for initial loads.
  const storeData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const rawCategories =
    storeData?.categories ?? instanceData?.config?.categories;
  const categories = useMemo(() => rawCategories ?? [], [rawCategories]);
  const hasCategories = categories.length > 0;
  const requireCategorySelection =
    storeData?.requireCategorySelection ??
    instanceData?.config?.requireCategorySelection ??
    false;
  const showCategoryField = hasCategories && requireCategorySelection;

  const initialTemplate = useMemo(() => {
    const saved = instanceData?.proposalTemplate as
      | ProposalTemplate
      | undefined;
    const base =
      saved && Object.keys(saved.properties ?? {}).length > 0
        ? saved
        : createDefaultTemplate(t('Proposal summary'), t('Proposal title'));

    // Ensure locked system fields are present (backward compat)
    return ensureLockedFields(base, {
      titleLabel: t('Proposal title'),
      categoryLabel: t('Category'),
      hasCategories,
      categories,
      requireCategorySelection,
    });
  }, [
    instanceData?.proposalTemplate,
    hasCategories,
    categories,
    requireCategorySelection,
  ]);

  const [template, setTemplate] = useState<ProposalTemplate>(initialTemplate);
  const isInitialLoadRef = useRef(true);

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
        hasCategories,
        categories,
        requireCategorySelection,
      }),
    );
  }, [hasCategories, categories, requireCategorySelection]);

  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  // "Show on blur, clear on change" validation: errors are snapshotted when
  // a field card loses focus, but resolved errors disappear immediately
  // while editing (see renderFieldCard intersection logic).
  const [fieldErrors, setFieldErrors] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;

  const setProposalTemplate = useProcessBuilderStore(
    (s) => s.setProposalTemplate,
  );
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  // Derive field views from the template, excluding locked system fields
  // that are always rendered separately above the sortable list.
  const fields = useMemo(
    () => getFields(template).filter((f) => !SYSTEM_FIELD_KEYS.has(f.id)),
    [template],
  );

  // Sidebar field list — includes visual-only locked fields at the top
  const sidebarFields = useMemo(() => {
    const locked = [
      {
        id: 'title',
        label: t('Proposal title'),
        fieldType: 'short_text' as const,
      },
      ...(showCategoryField
        ? [
            {
              id: 'category',
              label: t('Category'),
              fieldType: 'dropdown' as const,
            },
          ]
        : []),
      {
        id: 'budget',
        label: t('Budget'),
        icon: LuHash,
      },
    ];
    return [
      ...locked,
      ...fields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldType: f.fieldType,
      })),
    ];
  }, [fields, showCategoryField, t]);

  // Debounced auto-save to localStorage and backend.
  // Runs ensureLockedFields before persisting so that x-field-order and
  // required are always consistent — individual mutators only need to
  // touch properties.
  const debouncedSave = useDebouncedCallback(
    (updatedTemplate: ProposalTemplate) => {
      const normalized = ensureLockedFields(updatedTemplate, {
        titleLabel: t('Proposal title'),
        categoryLabel: t('Category'),
        hasCategories,
        categories,
        requireCategorySelection,
      });
      setProposalTemplate(decisionProfileId, normalized);
      updateInstance.mutate(
        {
          instanceId,
          proposalTemplate: normalized,
        },
        {
          onSuccess: () => markSaved(decisionProfileId),
          onError: () => setSaveStatus(decisionProfileId, 'error'),
        },
      );
    },
    AUTOSAVE_DEBOUNCE_MS,
  );

  // Trigger debounced save when template changes (skip initial load)
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    setSaveStatus(decisionProfileId, 'saving');
    debouncedSave(template);
  }, [template, decisionProfileId, setSaveStatus, debouncedSave]);

  const handleAddField = useCallback(
    (type: FieldType) => {
      const fieldId = crypto.randomUUID().slice(0, 8);
      const label = t(getFieldLabelKey(type));
      setTemplate((prev) => addFieldToTemplate(prev, fieldId, type, label));
    },
    [t],
  );

  const handleRemoveField = useCallback((fieldId: string) => {
    setTemplate((prev) => removeFieldFromTemplate(prev, fieldId));
    setFieldErrors((prev) => {
      const next = new Map(prev);
      next.delete(fieldId);
      return next;
    });
  }, []);

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
    [template],
  );

  const handleUpdateJsonSchema = useCallback(
    (fieldId: string, updates: Partial<ProposalPropertySchema>) => {
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

  /** Render a FieldCard for a given field view. */
  const renderFieldCard = (
    field: FieldView,
    controls?: Parameters<Parameters<typeof Sortable>[0]['children']>[1],
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
        onRemove={handleRemoveField}
        onBlur={handleFieldBlur}
        onUpdateLabel={handleUpdateLabel}
        onUpdateDescription={handleUpdateDescription}
        onUpdateRequired={handleUpdateRequired}
        onUpdateJsonSchema={handleUpdateJsonSchema}
      />
    );
  };

  return (
    <SidebarProvider isOpen={sidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <div className="flex h-full flex-col md:flex-row">
        <div className="flex items-center justify-between gap-2 p-4 md:hidden">
          <Header2 className="font-serif text-title-sm">
            {t('Proposal template')}
          </Header2>
          <FieldListTrigger />
        </div>

        <TemplateEditorSidebar
          fields={sidebarFields}
          onAddField={handleAddField}
          side={isMobile ? 'right' : 'left'}
        />

        <main className="flex-1 basis-1/2 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto max-w-160 space-y-4">
            <Header2 className="hidden font-serif text-title-sm md:mt-8 md:block">
              {t('Proposal template')}
            </Header2>
            <p className="text-neutral-charcoal">
              <span className="hidden md:inline">
                {t('Build your proposal using the tools on the left')}
              </span>
              <span className="md:hidden">
                {t('Build your proposal using the tools below')}
              </span>
            </p>
            <hr />

            {/* Locked system fields (stored in schema) */}
            <div className="mb-3 space-y-3">
              <FieldConfigCard
                icon={LuAlignLeft}
                iconTooltip={t('Short text')}
                label={t('Proposal title')}
                locked
              />
              {showCategoryField && (
                <FieldConfigCard
                  icon={LuChevronDown}
                  iconTooltip={t('Dropdown')}
                  label={t('Category')}
                  locked
                >
                  <p className="text-neutral-charcoal">
                    {t('These are the categories you defined in')}{' '}
                    <button
                      type="button"
                      className="cursor-pointer text-primary-teal hover:underline"
                      onClick={() => {
                        void setStep('general');
                        void setSection('proposalCategories');
                      }}
                    >
                      {t('Proposal Categories')}
                    </button>
                    .
                  </p>
                </FieldConfigCard>
              )}

              <BudgetFieldConfig
                template={template}
                onTemplateChange={setTemplate}
              />
            </div>

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
        </main>

        <ParticipantPreview template={template} />

        <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4 md:hidden">
          <AddFieldMenu onAddField={handleAddField} />
        </div>
      </div>
    </SidebarProvider>
  );
}
