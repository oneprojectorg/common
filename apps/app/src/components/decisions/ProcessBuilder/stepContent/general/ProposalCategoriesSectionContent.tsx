'use client';

import { trpc } from '@op/api/client';
import type { ProposalCategory } from '@op/common';
import { Button } from '@op/sense/Button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Header2, Header3 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
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
  // Seed from the store's merged view first, then fall back to server data
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
        <p className="text-neutral-gray4">
          {t(
            'Define the categories that proposals in this process should advance. Proposers will select which categories their proposal supports.',
          )}
        </p>
      </div>

      {showEmptyState && (
        <div className="rounded-lg border p-16">
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LuLeaf className="size-5" />
              </EmptyMedia>
              <EmptyTitle>{t('No categories defined yet')}</EmptyTitle>
              <EmptyDescription>
                {t(
                  'Categories help proposers understand what outcomes this process is trying to achieve.',
                )}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button className="mt-2" onClick={() => setIsFormVisible(true)}>
                <LuPlus className="size-4" />
                {t('Create first category')}
              </Button>
            </EmptyContent>
          </Empty>
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
                <span className="text-neutral-charcoal">{category.label}</span>
                <p className="text-sm text-neutral-gray4">
                  {category.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 p-0 text-neutral-charcoal"
                  onClick={() => handleEdit(category)}
                  aria-label={`Edit ${category.label}`}
                >
                  <LuPencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 p-0 text-neutral-charcoal hover:text-red"
                  onClick={() => handleDelete(category.id)}
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
              className="mt-2 px-2 text-primary-tealBlack hover:text-primary-teal"
              onClick={() => setIsFormVisible(true)}
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
            <CategoryField
              id="category-shorthand"
              label={t('Shorthand')}
              isRequired
              value={formLabel}
              onChange={setFormLabel}
              placeholder={t('e.g., Education')}
              description={t('1-3 words. Appears in dropdowns and cards.')}
              maxLength={CATEGORY_TITLE_MAX_LENGTH}
            />
            <CategoryField
              id="category-description"
              multiline
              label={t('Full description')}
              value={formDescription}
              onChange={setFormDescription}
              placeholder={t(
                'e.g., Expand access to quality education and workforce development in underserved communities',
              )}
              description={t(
                'Help proposers understand what this category means',
              )}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>
                {t('Cancel')}
              </Button>
              <Button onClick={handleAddOrUpdate} disabled={!formLabel.trim()}>
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
            <Switch
              checked={requireCategorySelection}
              onCheckedChange={handleRequireCategoryChange}
              size="sm"
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
            <Switch
              checked={allowMultipleCategories}
              onCheckedChange={handleAllowMultipleChange}
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Labelled text/textarea field with an optional live character counter —
// composes the sense Field + Input/Textarea primitives to reproduce the
// batteries-included @op/ui TextField this screen previously used.
function CategoryField({
  id,
  label,
  isRequired,
  value,
  onChange,
  placeholder,
  description,
  maxLength,
  multiline,
}: {
  id: string;
  label: string;
  isRequired?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label}
        {isRequired && <RequiredAsterisk />}
      </FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="[unicode-bidi:plaintext]"
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="[unicode-bidi:plaintext]"
        />
      )}
      {(description || maxLength != null) && (
        <div className="flex items-baseline justify-between gap-4">
          <div>
            {description && <FieldDescription>{description}</FieldDescription>}
          </div>
          {maxLength != null && (
            <span
              className={cn(
                'text-sm text-neutral-gray4',
                value.length === maxLength && 'text-functional-red',
              )}
            >
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
