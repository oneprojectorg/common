'use client';

import { trpc } from '@op/api/client';
import type { ProposalCategory } from '@op/common';
import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2, Header3 } from '@op/ui/Header';
import { Switch } from '@op/ui/Switch';
import { TextField } from '@op/ui/TextField';
import { useState } from 'react';
import { LuLeaf, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import type { ProcessBuilderInstanceData } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';
import { ensureLockedFields } from '@/components/decisions/proposalTemplate';

const CATEGORY_TITLE_MAX_LENGTH = 50;

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

  const storeData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  // Local state — immediate source of truth for UI
  // Seed from store (localStorage) first, then fall back to server data
  const [config, setConfig] = useState<CategoryConfig>(() => ({
    categories: storeData?.config?.categories ?? serverConfig?.categories ?? [],
    requireCategorySelection:
      storeData?.config?.requireCategorySelection ??
      serverConfig?.requireCategorySelection ??
      true,
    allowMultipleCategories:
      storeData?.config?.allowMultipleCategories ??
      serverConfig?.allowMultipleCategories ??
      false,
  }));

  const { categories, requireCategorySelection, allowMultipleCategories } =
    config;

  // Update local state and save via centralized autosave.
  // Also syncs the proposalTemplate so that the category field and required
  // array stay consistent with the config.
  const updateConfig = (update: Partial<CategoryConfig>) => {
    const updated = { ...config, ...update };
    setConfig(updated);

    const existingTemplate =
      storeData?.proposalTemplate ?? instance.instanceData.proposalTemplate;

    const payload: Partial<ProcessBuilderInstanceData> = { config: updated };

    if (existingTemplate) {
      payload.proposalTemplate = ensureLockedFields(existingTemplate, {
        titleLabel: t('Proposal title'),
        categoryLabel: t('Category'),
        categories: updated.categories,
        allowMultipleCategories: updated.allowMultipleCategories,
        requireCategorySelection: updated.requireCategorySelection,
      });
    }

    saveChanges(payload);
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

  const handleRequireCategoryChange = (value: boolean) => {
    updateConfig({ requireCategorySelection: value });
  };

  const handleAllowMultipleChange = (value: boolean) => {
    updateConfig({ allowMultipleCategories: value });
  };

  const showEmptyState = categories.length === 0 && !isFormVisible;
  const showList = categories.length > 0;

  return (
    <div className="mx-auto w-full space-y-6 p-4 [scrollbar-gutter:stable] md:max-w-160 md:p-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Header2 className="font-serif text-title-sm">
            {t('Proposal Categories')}
          </Header2>
          <SaveStatusIndicator
            status={autosaveStatus.status}
            savedAt={autosaveStatus.savedAt}
          />
        </div>
        <p className="text-muted-foreground">
          {t(
            'Define the categories that proposals in this process should advance. Proposers will select which categories their proposal supports.',
          )}
        </p>
      </div>

      {showEmptyState && (
        <div className="rounded-lg border p-16">
          <EmptyState icon={<LuLeaf className="size-5" />}>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="font-medium text-foreground">
                {t('No categories defined yet')}
              </span>
              <span>
                {t(
                  'Categories help proposers understand what outcomes this process is trying to achieve.',
                )}
              </span>
              <Button
                variant="default"
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
              className="group flex items-start gap-2 border-b py-3"
            >
              <div className="min-w-0 flex-1">
                <span className="text-foreground">{category.label}</span>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-5 p-0 text-foreground"
                  onPress={() => handleEdit(category)}
                  aria-label={`Edit ${category.label}`}
                >
                  <LuPencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-5 p-0 text-foreground hover:text-destructive"
                  onPress={() => handleDelete(category.id)}
                  aria-label={`Delete ${category.label}`}
                >
                  <LuTrash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {!isFormVisible && (
            <Button
              variant="ghost"
              className="mt-2 px-2 text-primary hover:text-primary/80"
              onPress={() => setIsFormVisible(true)}
            >
              <LuPlus className="size-4" />
              {t('Add category')}
            </Button>
          )}
        </div>
      )}

      {isFormVisible && (
        <div className="rounded border p-4">
          <Header3 className="mb-4 font-serif text-title-xs">
            {editingId ? t('Edit category') : t('Add category')}
          </Header3>
          <div className="space-y-4">
            <TextField
              label={t('Shorthand')}
              isRequired
              value={formLabel}
              onChange={setFormLabel}
              inputProps={{
                placeholder: t('e.g., Education'),
              }}
              description={t('1-3 words. Appears in dropdowns and cards.')}
              maxLength={CATEGORY_TITLE_MAX_LENGTH}
            />
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
              <Button variant="outline" onPress={resetForm}>
                {t('Cancel')}
              </Button>
              <Button
                variant="default"
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
              <p className="text-sm text-muted-foreground">
                {t('Proposers must select at least one category')}
              </p>
            </div>
            <Switch
              isSelected={requireCategorySelection}
              onChange={handleRequireCategoryChange}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-base">
                {t('Allow multiple categories')}
              </span>
              <p className="text-sm text-muted-foreground">
                {t('Proposers can select more than one category')}
              </p>
            </div>
            <Switch
              isSelected={allowMultipleCategories}
              onChange={handleAllowMultipleChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
