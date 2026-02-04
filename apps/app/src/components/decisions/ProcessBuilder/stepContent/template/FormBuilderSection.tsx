'use client';

import { SidebarProvider } from '@op/ui/Sidebar';
import { Sortable } from '@op/ui/Sortable';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';
import { AddFieldMenu } from './AddFieldMenu';
import {
  FieldCard,
  FieldCardDragPreview,
  FieldCardDropIndicator,
} from './FieldCard';
import {
  FormBuilderMobileTrigger,
  FormBuilderSidebar,
} from './FormBuilderSidebar';
import { getFieldLabelKey } from './fieldRegistry';
import type { FieldType, FormField } from './types';

/**
 * Locked fields that appear at the top of the form.
 * These cannot be reordered or removed.
 */
const LOCKED_FIELDS: FormField[] = [
  {
    id: 'proposal-title',
    type: 'short_text',
    label: 'Proposal Title',
    required: true,
    locked: true,
  },
  {
    id: 'category',
    type: 'dropdown',
    label: 'Category',
    required: true,
    locked: true,
  },
];

/**
 * Default sortable fields for new forms.
 */
const DEFAULT_SORTABLE_FIELDS: FormField[] = [
  {
    id: 'proposal-summary',
    type: 'long_text',
    label: 'Proposal Summary',
    required: false,
    locked: false,
  },
];

export default function FormBuilderSection({
  decisionProfileId,
}: SectionProps) {
  const t = useTranslations();
  const [sortableFields, setSortableFields] = useState<FormField[]>(
    DEFAULT_SORTABLE_FIELDS,
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  const { getTemplateConfig, setTemplateConfig, setSaveStatus, markSaved } =
    useProcessBuilderStore();

  // Combine locked + sortable fields for display and persistence
  const allFields = useMemo(
    () => [...LOCKED_FIELDS, ...sortableFields],
    [sortableFields],
  );

  // Hydrate from store on mount
  useEffect(() => {
    const unsubscribe = useProcessBuilderStore.persist.onFinishHydration(() => {
      const savedConfig = getTemplateConfig(decisionProfileId);
      if (savedConfig?.fields) {
        // Filter out locked fields from saved config (we always use the constant)
        const savedSortableFields = savedConfig.fields.filter((f) => !f.locked);
        if (savedSortableFields.length > 0) {
          setSortableFields(savedSortableFields);
        }
      }
      setHasHydrated(true);
    });

    void useProcessBuilderStore.persist.rehydrate();

    return unsubscribe;
  }, [decisionProfileId, getTemplateConfig]);

  // Auto-save to store when fields change (debounced)
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    setSaveStatus(decisionProfileId, 'saving');

    const timeoutId = setTimeout(() => {
      // Save all fields (locked + sortable) to maintain full config
      setTemplateConfig(decisionProfileId, { fields: allFields });
      markSaved(decisionProfileId);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    allFields,
    hasHydrated,
    decisionProfileId,
    setTemplateConfig,
    setSaveStatus,
    markSaved,
  ]);

  const handleAddField = useCallback(
    (type: FieldType) => {
      const newField: FormField = {
        id: crypto.randomUUID(),
        type,
        label: t(getFieldLabelKey(type)),
        required: false,
        locked: false,
      };

      setSortableFields((prev) => [...prev, newField]);
    },
    [t],
  );

  const handleRemoveField = useCallback((fieldId: string) => {
    setSortableFields((prev) => prev.filter((f) => f.id !== fieldId));
  }, []);

  const handleReorderFields = useCallback((newFields: FormField[]) => {
    setSortableFields(newFields);
  }, []);

  return (
    <SidebarProvider>
      <div className="flex h-full flex-col md:flex-row">
        {/* Mobile header with sidebar trigger */}
        <div className="flex items-center gap-2 border-b p-4 md:hidden">
          <FormBuilderMobileTrigger />
          <h2 className="font-serif text-title-sm">{t('Proposal template')}</h2>
        </div>

        {/* Sidebar - hidden on mobile, slides in as drawer */}
        <FormBuilderSidebar fields={allFields} onAddField={handleAddField} />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto max-w-160">
            {/* Desktop title - hidden on mobile (shown in mobile header) */}
            <h2 className="hidden font-serif text-title-sm md:block">
              {t('Proposal template')}
            </h2>
            {/* Responsive subtitle */}
            <p className="mb-6 text-neutral-charcoal">
              <span className="hidden md:inline">
                {t('Build your proposal using the tools on the left')}
              </span>
              <span className="md:hidden">
                {t('Build your proposal using the tools below')}
              </span>
            </p>

            {/* Locked fields - rendered statically outside Sortable */}
            <div className="mb-3 space-y-3">
              {LOCKED_FIELDS.map((field) => (
                <FieldCard key={field.id} field={field} />
              ))}
            </div>

            {/* Sortable fields */}
            <Sortable
              items={sortableFields}
              onChange={handleReorderFields}
              dragTrigger="handle"
              getItemLabel={(field) => field.label}
              className="gap-3"
              renderDragPreview={(items) =>
                items[0] ? <FieldCardDragPreview field={items[0]} /> : null
              }
              renderDropIndicator={FieldCardDropIndicator}
              aria-label={t('Form fields')}
            >
              {(field, controls) => (
                <FieldCard
                  field={field}
                  controls={controls}
                  onRemove={handleRemoveField}
                />
              )}
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
