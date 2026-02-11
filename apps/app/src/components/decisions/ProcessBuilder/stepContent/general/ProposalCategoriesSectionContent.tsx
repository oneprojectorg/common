'use client';

import { trpc } from '@op/api/client';
import { useDebouncedCallback } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { cn } from '@op/ui/utils';
import { useState } from 'react';
import { LuLeaf, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { ProposalCategory } from '@op/common';

import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;
const CATEGORY_TITLE_MAX_LENGTH = 40;

interface CategoryConfig {
  categories: ProposalCategory[];
  requireCategorySelection: boolean;
  allowMultipleCategories: boolean;
}

export function ProposalCategoriesSectionContent({
  decisionProfileId,
  instanceId,
}: SectionProps) {
  const t = useTranslations();

  // Fetch server data for seeding
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const serverConfig = instance.instanceData?.config;

  // Zustand store
  const storeData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);

  // Local state — immediate source of truth for UI
  // Seed from store (localStorage) first, then fall back to server data
  const [config, setConfig] = useState<CategoryConfig>(() => ({
    categories:
      storeData?.categories ?? serverConfig?.categories ?? [],
    requireCategorySelection:
      storeData?.requireCategorySelection ??
      serverConfig?.requireCategorySelection ??
      true,
    allowMultipleCategories:
      storeData?.allowMultipleCategories ??
      serverConfig?.allowMultipleCategories ??
      false,
  }));

  const { categories, requireCategorySelection, allowMultipleCategories } =
    config;

  // tRPC mutation
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  // Debounced auto-save: writes to Zustand store + API
  const debouncedSave = useDebouncedCallback((data: CategoryConfig) => {
    setSaveStatus(decisionProfileId, 'saving');
    setInstanceData(decisionProfileId, data);
    updateInstance.mutate(
      {
        instanceId,
        config: data,
      },
      {
        onSuccess: () => markSaved(decisionProfileId),
        onError: () => setSaveStatus(decisionProfileId, 'error'),
      },
    );
  }, AUTOSAVE_DEBOUNCE_MS);

  // Update local state and trigger debounced save
  const updateConfig = (update: Partial<CategoryConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...update };
      debouncedSave(updated);
      return updated;
    });
  };

  // Ephemeral form UI state
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const resetForm = () => {
    setFormLabel('');
    setFormDescription('');
    setEditingId(null);
    setIsFormVisible(false);
  };

  const handleAddOrUpdate = () => {
    if (!formLabel.trim()) {
      return;
    }

    let updatedCategories: ProposalCategory[];
    if (editingId) {
      updatedCategories = categories.map((cat) =>
        cat.id === editingId
          ? {
              ...cat,
              label: formLabel.trim(),
              description: formDescription.trim(),
            }
          : cat,
      );
    } else {
      updatedCategories = [
        ...categories,
        {
          id: crypto.randomUUID(),
          label: formLabel.trim(),
          description: formDescription.trim(),
          checked: true,
        },
      ];
    }

    updateConfig({ categories: updatedCategories });
    resetForm();
  };

  const handleEdit = (category: ProposalCategory) => {
    setFormLabel(category.label);
    setFormDescription(category.description);
    setEditingId(category.id);
    setIsFormVisible(true);
  };

  const handleDelete = (id: string) => {
    const updatedCategories = categories.filter((cat) => cat.id !== id);
    updateConfig({ categories: updatedCategories });
    if (editingId === id) {
      resetForm();
    }
  };

  const handleToggleChecked = (id: string) => {
    const updatedCategories = categories.map((cat) =>
      cat.id === id ? { ...cat, checked: !cat.checked } : cat,
    );
    updateConfig({ categories: updatedCategories });
  };

  const handleRequireCategoryChange = (value: boolean) => {
    updateConfig({ requireCategorySelection: value });
  };

  const handleAllowMultipleChange = (value: boolean) => {
    updateConfig({ allowMultipleCategories: value });
  };

  const showEmptyState = categories.length === 0 && !isFormVisible;
  const showForm = isFormVisible;
  const showList = categories.length > 0;

  return (
    <div className="mx-auto w-full max-w-160 space-y-6 p-4 md:p-8">
      <div className="space-y-2">
        <Header2 className="font-serif text-title-sm">
          {t('Proposal Categories')}
        </Header2>
        <p className="text-neutral-gray4">
          {t(
            'Define the categories that proposals in this process should advance. Proposers will select which categories their proposal supports.',
          )}
        </p>
      </div>

      {showEmptyState && (
        <div className="rounded-lg border p-16">
          <EmptyState icon={<LuLeaf className="size-5" />}>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="font-medium text-neutral-charcoal">
                {t('No categories defined yet')}
              </span>
              <span>
                {t(
                  'Categories help proposers understand what outcomes this process is trying to achieve.',
                )}
              </span>
              <Button
                color="primary"
                className="mt-2"
                onPress={() => setIsFormVisible(true)}
              >
                <LuPlus className="size-4" />
                {t('Create first category')}
              </Button>
            </div>
          </EmptyState>
        </div>
      )}

      {showList && (
        <div>
          {categories.map((category) => (
            <div
              key={category.id}
              className="group flex items-start gap-2 py-3"
            >
              <Checkbox
                size="small"
                isSelected={category.checked}
                onChange={() => handleToggleChecked(category.id)}
                aria-label={category.label}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <span className="text-neutral-charcoal">{category.label}</span>
                <p className="text-sm text-neutral-gray4">
                  {category.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="icon"
                  color="ghost"
                  className="size-5 p-0 text-neutral-charcoal"
                  onPress={() => handleEdit(category)}
                  aria-label={`Edit ${category.label}`}
                >
                  <LuPencil className="size-4" />
                </Button>
                <Button
                  variant="icon"
                  color="ghost"
                  className="size-5 p-0 text-neutral-charcoal hover:text-red"
                  onPress={() => handleDelete(category.id)}
                  aria-label={`Delete ${category.label}`}
                >
                  <LuTrash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {!showForm && (
            <Button
              color="ghost"
              className="px-2 text-primary-teal hover:text-primary-tealBlack"
              onPress={() => setIsFormVisible(true)}
            >
              <LuPlus className="size-4" />
              {t('Add category')}
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <div className="rounded border p-4">
          <h3 className="mb-4 font-serif text-title-xs">
            {editingId ? t('Edit category') : t('Add category')}
          </h3>
          <div className="space-y-4">
            <div className="-space-y-4">
              <TextField
                label={t('Shorthand')}
                isRequired
                value={formLabel}
                onChange={setFormLabel}
                inputProps={{
                  placeholder: t('e.g., Education'),
                  maxLength: CATEGORY_TITLE_MAX_LENGTH,
                }}
                description={t('1-3 words. Appears in dropdowns and cards.')}
              />
              <span
                className={cn(
                  'block text-right text-xs text-neutral-gray4',
                  formLabel.length === CATEGORY_TITLE_MAX_LENGTH &&
                    'text-functional-red',
                )}
              >
                {formLabel.length}/{CATEGORY_TITLE_MAX_LENGTH}
              </span>
            </div>
            <TextField
              useTextArea
              label={t('Full description')}
              value={formDescription}
              onChange={setFormDescription}
              textareaProps={{
                placeholder: t(
                  'e.g., Expand access to quality education and workforce development in underserved communities',
                ),
              }}
              description={t(
                'Help proposers understand what this category means',
              )}
            />
            <div className="flex items-center justify-end gap-2">
              <Button color="secondary" onPress={resetForm}>
                {t('Cancel')}
              </Button>
              <Button
                color="primary"
                onPress={handleAddOrUpdate}
                isDisabled={!formLabel.trim()}
              >
                {editingId ? t('Save changes') : t('Add category')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-base">
                {t('Require category selection')}
              </span>
              <p className="text-sm text-neutral-gray4">
                {t('Proposers must select at least one category')}
              </p>
            </div>
            <ToggleButton
              isSelected={requireCategorySelection}
              onChange={handleRequireCategoryChange}
              size="small"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-base">
                {t('Allow multiple categories')}
              </span>
              <p className="text-sm text-neutral-gray4">
                {t('Proposers can select more than one category')}
              </p>
            </div>
            <ToggleButton
              isSelected={allowMultipleCategories}
              onChange={handleAllowMultipleChange}
              size="small"
            />
          </div>
        </div>
      )}
    </div>
  );
}
