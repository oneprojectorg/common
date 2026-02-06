'use client';

import { useDebouncedCallback, useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { SidebarProvider } from '@op/ui/Sidebar';
import { Sortable } from '@op/ui/Sortable';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import type { FieldType, FormField } from './types';

/**
 * Locked field definitions (without labels - labels are added with translations).
 * TODO: Replace with RJSF schema from database.
 */
const LOCKED_FIELD_DEFINITIONS = [
  {
    id: 'proposal-title',
    type: 'short_text' as const,
    labelKey: 'Proposal title',
  },
  { id: 'category', type: 'dropdown' as const, labelKey: 'Category' },
] as const;

/**
 * Default sortable field definitions (without labels - labels are added with translations).
 * TODO: Replace with RJSF schema from database.
 */
const DEFAULT_SORTABLE_FIELD_DEFINITIONS = [
  {
    id: 'proposal-summary',
    type: 'long_text' as const,
    labelKey: 'Proposal summary',
  },
] as const;

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function TemplateEditorContent({
  decisionProfileId,
}: {
  decisionProfileId: string;
}) {
  const t = useTranslations();

  // Build locked fields with translated labels
  const lockedFields = useMemo<FormField[]>(
    () =>
      LOCKED_FIELD_DEFINITIONS.map((def) => ({
        id: def.id,
        type: def.type,
        label: t(def.labelKey),
        required: true,
        locked: true,
      })),
    [t],
  );

  // Build default sortable fields with translated labels
  const defaultSortableFields = useMemo<FormField[]>(
    () =>
      DEFAULT_SORTABLE_FIELD_DEFINITIONS.map((def) => ({
        id: def.id,
        type: def.type,
        label: t(def.labelKey),
        required: false,
        locked: false,
      })),
    [t],
  );

  const [sortableFields, setSortableFields] = useState<FormField[]>(
    defaultSortableFields,
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  // Sidebar is always open on desktop, toggleable on mobile
  const isMobile = useMediaQuery(`(max-width: ${screens.md})`);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarOpen = isMobile ? mobileSidebarOpen : true;

  const { getTemplateConfig, setTemplateConfig, setSaveStatus, markSaved } =
    useProcessBuilderStore();

  // Combine locked + sortable fields for display and persistence
  const allFields = useMemo(
    () => [...lockedFields, ...sortableFields],
    [lockedFields, sortableFields],
  );

  // Debounced auto-save function
  const debouncedSave = useDebouncedCallback((fields: FormField[]) => {
    setTemplateConfig(decisionProfileId, { fields });
    markSaved(decisionProfileId);
  }, AUTOSAVE_DEBOUNCE_MS);

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

  // Trigger debounced save when fields change
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    setSaveStatus(decisionProfileId, 'saving');
    debouncedSave(allFields);
  }, [allFields, hasHydrated, decisionProfileId, setSaveStatus, debouncedSave]);

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

  const handleUpdateField = useCallback(
    (fieldId: string, updates: Partial<FormField>) => {
      setSortableFields((prev) =>
        prev.map((field) =>
          field.id === fieldId ? { ...field, ...updates } : field,
        ),
      );
    },
    [],
  );

  // Show skeleton while store is hydrating
  if (!hasHydrated) {
    return <TemplateEditorSkeleton />;
  }

  return (
    <SidebarProvider isOpen={sidebarOpen} onOpenChange={setMobileSidebarOpen}>
      <div className="flex h-full flex-col md:flex-row">
        {/* Mobile header with sidebar trigger */}
        <div className="flex items-center justify-between gap-2 p-4 md:hidden">
          <h2 className="font-serif text-title-sm">{t('Proposal template')}</h2>
          <FieldListTrigger />
        </div>

        {/* Sidebar - hidden on mobile, slides in as drawer */}
        <TemplateEditorSidebar
          fields={allFields}
          onAddField={handleAddField}
          side={isMobile ? 'right' : 'left'}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto max-w-160 space-y-4">
            {/* Desktop title - hidden on mobile (shown in mobile header) */}
            <h2 className="hidden font-serif text-title-sm md:mt-8 md:block">
              {t('Proposal template')}
            </h2>
            {/* Responsive subtitle */}
            <p className="text-neutral-charcoal">
              <span className="hidden md:inline">
                {t('Build your proposal using the tools on the left')}
              </span>
              <span className="md:hidden">
                {t('Build your proposal using the tools below')}
              </span>
            </p>
            <hr />
            {/* Locked fields - rendered statically outside Sortable */}
            <div className="mb-3 space-y-3">
              {lockedFields.map((field) => (
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
                  onUpdate={handleUpdateField}
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
