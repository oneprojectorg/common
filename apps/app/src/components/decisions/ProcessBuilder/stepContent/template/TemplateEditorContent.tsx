'use client';

import { trpc } from '@op/api/client';
import { useDebouncedCallback, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Header2 } from '@op/ui/Header';
import { SidebarProvider } from '@op/ui/Sidebar';
import { Sortable } from '@op/ui/Sortable';
import type { UiSchema } from '@rjsf/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  type FieldType,
  type FieldView,
  type ProposalTemplate,
  addField as addFieldToTemplate,
  createDefaultTemplate,
  getFieldOrder,
  getFieldSchema,
  getFieldUi,
  getFields,
  isFieldLocked,
  removeField as removeFieldFromTemplate,
  reorderFields as reorderTemplateFields,
  setFieldRequired,
  updateFieldDescription,
  updateFieldLabel,
} from '../../../proposalTemplate';
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

export function TemplateEditorContent({
  decisionProfileId,
  instanceId,
}: {
  decisionProfileId: string;
  instanceId: string;
}) {
  const t = useTranslations();

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

  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;

  const { getProposalTemplate, setProposalTemplate, setSaveStatus, markSaved } =
    useProcessBuilderStore();

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();
  const isInitialLoadRef = useRef(true);

  // Derive all field views from the template
  const allFields = useMemo(() => getFields(template), [template]);
  const lockedFields = useMemo(
    () => allFields.filter((f) => f.locked),
    [allFields],
  );
  const sortableFields = useMemo(
    () => allFields.filter((f) => !f.locked),
    [allFields],
  );

  // Sidebar field list
  const sidebarFields = useMemo(
    () =>
      allFields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldType: f.fieldType,
      })),
    [allFields],
  );

  // Debounced auto-save to localStorage AND backend
  const debouncedSave = useDebouncedCallback(
    (updatedTemplate: ProposalTemplate) => {
      setProposalTemplate(decisionProfileId, updatedTemplate);
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
    (newItems: FieldView[]) => {
      const lockedIds = getFieldOrder(template).filter((id) =>
        isFieldLocked(template, id),
      );
      const newOrder = [...lockedIds, ...newItems.map((item) => item.id)];
      setTemplate((prev) => reorderTemplateFields(prev, newOrder));
    },
    [template],
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

  /** Render a FieldCard for a given field view. */
  const renderFieldCard = (
    field: FieldView,
    controls?: Parameters<Parameters<typeof Sortable>[0]['children']>[1],
  ) => (
    <FieldCard
      key={field.id}
      field={field}
      fieldSchema={getFieldSchema(template, field.id) ?? {}}
      fieldUiSchema={getFieldUi(template, field.id)}
      controls={controls}
      onRemove={field.locked ? undefined : handleRemoveField}
      onUpdateLabel={handleUpdateLabel}
      onUpdateDescription={handleUpdateDescription}
      onUpdateRequired={handleUpdateRequired}
      onUpdateJsonSchema={handleUpdateJsonSchema}
      onUpdateUiSchema={handleUpdateUiSchema}
    />
  );

  if (!hasHydrated) {
    return <TemplateEditorSkeleton />;
  }

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
              {lockedFields.map((field) => renderFieldCard(field))}
            </div>

            {/* Sortable fields */}
            <Sortable
              items={sortableFields}
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

        <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4 md:hidden">
          <AddFieldMenu onAddField={handleAddField} />
        </div>
      </div>
    </SidebarProvider>
  );
}
