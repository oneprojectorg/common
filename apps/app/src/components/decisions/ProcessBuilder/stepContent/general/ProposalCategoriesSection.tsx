'use client';

import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { useState } from 'react';
import { LuLeaf, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';

interface CategoryItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

export default function ProposalCategoriesSection(_props: SectionProps) {
  const t = useTranslations();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [requireCategory, setRequireCategory] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);

  const resetForm = () => {
    setFormLabel('');
    setFormDescription('');
    setEditingId(null);
    setIsFormVisible(false);
  };

  const handleAddOrUpdate = () => {
    if (!formLabel.trim() || !formDescription.trim()) {
      return;
    }

    if (editingId) {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === editingId
            ? {
                ...cat,
                label: formLabel.trim(),
                description: formDescription.trim(),
              }
            : cat,
        ),
      );
    } else {
      setCategories((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          label: formLabel.trim(),
          description: formDescription.trim(),
          checked: true,
        },
      ]);
    }

    resetForm();
  };

  const handleEdit = (category: CategoryItem) => {
    setFormLabel(category.label);
    setFormDescription(category.description);
    setEditingId(category.id);
    setIsFormVisible(true);
  };

  const handleDelete = (id: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
    if (editingId === id) {
      resetForm();
    }
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
                onChange={() =>
                  setCategories((prev) =>
                    prev.map((cat) =>
                      cat.id === category.id
                        ? { ...cat, checked: !cat.checked }
                        : cat,
                    ),
                  )
                }
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
            <TextField
              label={t('Shorthand')}
              isRequired
              value={formLabel}
              onChange={setFormLabel}
              inputProps={{
                placeholder: t('e.g., Education'),
              }}
              description={t('1-3 words. Appears in dropdowns and cards.')}
            />
            <TextField
              useTextArea
              label={t('Full description')}
              isRequired
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
                isDisabled={!formLabel.trim() || !formDescription.trim()}
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
              isSelected={requireCategory}
              onChange={setRequireCategory}
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
              isSelected={allowMultiple}
              onChange={setAllowMultiple}
              size="small"
            />
          </div>
        </div>
      )}
    </div>
  );
}
