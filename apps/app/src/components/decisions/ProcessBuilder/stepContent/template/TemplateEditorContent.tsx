'use client';

import { trpc } from '@op/api/client';
import {
  type FieldType,
  type ProposalTemplate,
  addField as addFieldToTemplate,
  createDefaultTemplate,
  getFieldLabel,
  getFieldOrder,
  getFieldSchema,
  getFieldType,
  getFieldUi,
  isFieldLocked,
  isFieldRequired,
  removeField as removeFieldFromTemplate,
  reorderFields as reorderTemplateFields,
  setFieldRequired,
  updateFieldDescription,
  updateFieldLabel,
} from '@op/common';
import { useDebouncedCallback, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Header2 } from '@op/ui/Header';
import { SidebarProvider } from '@op/ui/Sidebar';
import { Sortable } from '@op/ui/Sortable';
import type { UiSchema } from '@rjsf/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { AddFieldMenu } from './AddFieldMenu';
import {
  FieldCard,
  FieldCardDragPreview,
  FieldCardDropIndicator,
} from './FieldCard';
import {
  FieldListTrigger,
  TemplateEditorSidebar,
} from './TemplateEditorSidebar';
import { TemplateEditorSkeleton } from './TemplateEditorSkeleton';
import { getFieldLabelKey } from './fieldRegistry';

const AUTOSAVE_DEBOUNCE_MS = 1000;

/**
 * Sortable item — just an id so the Sortable component can track them.
 */
interface SortableFieldItem {
  id: string;
}

export function TemplateEditorContent({
  decisionProfileId,
  instanceId,
}: {
  decisionProfileId: string;
  instanceId: string;
}) {
  const t = useTranslations();

  // Build default template with translated labels
  const defaultTemplate = useMemo(
    () =>
      createDefaultTemplate({
        proposalTitle: t('Proposal title'),
        category: t('Category'),
        proposalSummary: t('Proposal summary'),
      }),
    [t],
  );

  const [template, setTemplate] = useState<ProposalTemplate>(defaultTemplate);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Sidebar is always open on desktop, toggleable on mobile
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;

  const { getProposalTemplate, setProposalTemplate, setSaveStatus, markSaved } =
    useProcessBuilderStore();

  // tRPC mutation for backend persistence
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  // Track whether we should skip the initial auto-save
  const isInitialLoadRef = useRef(true);

  // Derive field order and split into locked vs sortable
  const fieldOrder = useMemo(() => getFieldOrder(template), [template]);
  const lockedFieldIds = useMemo(
    () => fieldOrder.filter((id) => isFieldLocked(template, id)),
    [fieldOrder, template],
  );
  const sortableFieldIds = useMemo(
    () => fieldOrder.filter((id) => !isFieldLocked(template, id)),
    [fieldOrder, template],
  );
  const sortableItems: SortableFieldItem[] = useMemo(
    () => sortableFieldIds.map((id) => ({ id })),
    [sortableFieldIds],
  );

  // Derive sidebar field list
  const sidebarFields = useMemo(
    () =>
      fieldOrder.map((id) => ({
        id,
        label: getFieldLabel(template, id),
        fieldType: getFieldType(template, id) ?? ('short_text' as FieldType),
      })),
    [fieldOrder, template],
  );

  // Debounced auto-save to localStorage AND backend
  const debouncedSave = useDebouncedCallback(
    (updatedTemplate: ProposalTemplate) => {
      // Save to Zustand (localStorage)
      setProposalTemplate(decisionProfileId, updatedTemplate);

      // Save to backend
      updateInstance.mutate(
        {
          instanceId,
          proposalTemplate: updatedTemplate as unknown as Record<
            string,
            unknown
          >,
        },
        {
          onSuccess: () => markSaved(decisionProfileId),
          onError: () => setSaveStatus(decisionProfileId, 'error'),
        },
      );
    },
    AUTOSAVE_DEBOUNCE_MS,
  );

  // Hydrate from store on mount
  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      const savedTemplate = getProposalTemplate(decisionProfileId);
      if (savedTemplate && savedTemplate.properties) {
        setTemplate(savedTemplate);
      }
      setHasHydrated(true);
      // After hydration, allow saves
      isInitialLoadRef.current = false;
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, [decisionProfileId, getProposalTemplate]);

  // Trigger debounced save when template changes
  useEffect(() => {
    if (!hasHydrated || isInitialLoadRef.current) {
      return;
    }

    setSaveStatus(decisionProfileId, 'saving');
    debouncedSave(template);
  }, [template, hasHydrated, decisionProfileId, setSaveStatus, debouncedSave]);

  const handleAddField = useCallback(
    (type: FieldType) => {
      const fieldId = crypto.randomUUID();
      const label = t(getFieldLabelKey(type));
      setTemplate((prev) => addFieldToTemplate(prev, fieldId, type, label));
    },
    [t],
  );

  const handleRemoveField = useCallback((fieldId: string) => {
    setTemplate((prev) => removeFieldFromTemplate(prev, fieldId));
  }, []);

  const handleReorderFields = useCallback(
    (newItems: SortableFieldItem[]) => {
      const newOrder = [...lockedFieldIds, ...newItems.map((item) => item.id)];
      setTemplate((prev) => reorderTemplateFields(prev, newOrder));
    },
    [lockedFieldIds],
  );

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

  const handleUpdateJsonSchema = useCallback(
    (fieldId: string, updates: Record<string, unknown>) => {
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

  const handleUpdateUiSchema = useCallback(
    (fieldId: string, updates: Partial<UiSchema>) => {
      setTemplate((prev) => {
        const existing = getFieldUi(prev, fieldId);
        return {
          ...prev,
          ui: {
            ...prev.ui,
            [fieldId]: { ...existing, ...updates },
          },
        };
      });
    },
    [],
  );

  if (!hasHydrated) {
    return <TemplateEditorSkeleton />;
  }

  return (
    <SidebarProvider isOpen={sidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <div className="flex h-full flex-col md:flex-row">
        {/* Mobile header with sidebar trigger */}
        <div className="flex items-center justify-between gap-2 p-4 md:hidden">
          <Header2 className="font-serif text-title-sm">
            {t('Proposal template')}
          </Header2>
          <FieldListTrigger />
        </div>

        {/* Sidebar */}
        <TemplateEditorSidebar
          fields={sidebarFields}
          onAddField={handleAddField}
          side={isMobile ? 'right' : 'left'}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
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

            {/* Locked fields */}
            <div className="mb-3 space-y-3">
              {lockedFieldIds.map((fieldId) => {
                const fieldSchema = getFieldSchema(template, fieldId) ?? {};
                const fieldUiSchema = getFieldUi(template, fieldId);
                const fieldType =
                  getFieldType(template, fieldId) ?? 'short_text';
                return (
                  <FieldCard
                    key={fieldId}
                    fieldId={fieldId}
                    fieldSchema={fieldSchema}
                    fieldUiSchema={fieldUiSchema}
                    fieldType={fieldType}
                    isLocked
                    isRequired={isFieldRequired(template, fieldId)}
                  />
                );
              })}
            </div>

            {/* Sortable fields */}
            <Sortable
              items={sortableItems}
              onChange={handleReorderFields}
              dragTrigger="handle"
              getItemLabel={(item) => getFieldLabel(template, item.id)}
              className="gap-3"
              renderDragPreview={(items) => {
                const item = items[0];
                if (!item) {
                  return null;
                }
                const ft = getFieldType(template, item.id) ?? 'short_text';
                return (
                  <FieldCardDragPreview
                    fieldType={ft}
                    label={getFieldLabel(template, item.id)}
                  />
                );
              }}
              renderDropIndicator={FieldCardDropIndicator}
              aria-label={t('Form fields')}
            >
              {(item, controls) => {
                const fieldSchema = getFieldSchema(template, item.id) ?? {};
                const fieldUiSchema = getFieldUi(template, item.id);
                const fieldType =
                  getFieldType(template, item.id) ?? 'short_text';
                return (
                  <FieldCard
                    fieldId={item.id}
                    fieldSchema={fieldSchema}
                    fieldUiSchema={fieldUiSchema}
                    fieldType={fieldType}
                    isLocked={false}
                    isRequired={isFieldRequired(template, item.id)}
                    controls={controls}
                    onRemove={handleRemoveField}
                    onUpdateLabel={handleUpdateLabel}
                    onUpdateDescription={handleUpdateDescription}
                    onUpdateRequired={handleUpdateRequired}
                    onUpdateJsonSchema={handleUpdateJsonSchema}
                    onUpdateUiSchema={handleUpdateUiSchema}
                  />
                );
              }}
            </Sortable>
          </div>
        </main>

        {/* Mobile sticky footer with Add field button */}
        <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4 md:hidden">
          <AddFieldMenu onAddField={handleAddField} />
        </div>
      </div>
    </SidebarProvider>
  );
}
