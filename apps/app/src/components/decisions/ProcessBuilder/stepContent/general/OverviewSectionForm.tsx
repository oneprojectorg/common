'use client';

import { trpc } from '@op/api/client';
import { useDebouncedCallback } from '@op/hooks';
import { NumberField } from '@op/ui/NumberField';
import { SelectItem } from '@op/ui/Select';
import { useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';
import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import type { FormInstanceData } from '../../stores/useProcessBuilderStore';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

// Form data type
interface OverviewFormData {
  steward: string;
  objective: string;
  name: string;
  description: string;
  budget: number | undefined;
  hideBudget: boolean;
  enableCategories: boolean;
  includeReview: boolean;
  isPrivate: boolean;
}

// Form component - only rendered after Zustand hydration is complete
export function OverviewSectionForm({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  const previousValuesRef = useRef<string | null>(null);

  // tRPC mutation
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation();

  // Zustand store - using new instanceData structure
  const instanceData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);

  // Debounced auto-save function (similar to ProposalEditor pattern)
  const debouncedSave = useDebouncedCallback((values: OverviewFormData) => {
    const valuesString = JSON.stringify(values);

    // Skip if values haven't changed (prevents save loop from form.Subscribe re-renders)
    if (valuesString === previousValuesRef.current) {
      return;
    }
    previousValuesRef.current = valuesString;

    setSaveStatus(decisionProfileId, 'saving');
    setInstanceData(decisionProfileId, {
      name: values.name,
      description: values.description,
      steward: values.steward,
      objective: values.objective,
      budget: values.budget,
      hideBudget: values.hideBudget,
      enableCategories: values.enableCategories,
      includeReview: values.includeReview,
      isPrivate: values.isPrivate,
    } satisfies Partial<FormInstanceData>);

    // Mark as saved with timestamp
    markSaved(decisionProfileId);

    // TODO: Add API mutation here once storage location is decided
  }, AUTOSAVE_DEBOUNCE_MS);

  // Mock options - these would come from API
  const stewardOptions = [
    { id: 'one-project', label: 'One Project' },
    { id: 'committee', label: 'Committee' },
    { id: 'coalition', label: 'Coalition' },
  ];

  const form = useAppForm({
    defaultValues: {
      // Form fields (some in backend InstanceData, some form-only)
      steward: instanceData?.steward ?? '',
      objective: instanceData?.objective ?? '',
      budget: instanceData?.budget,
      hideBudget: instanceData?.hideBudget ?? true,
      enableCategories: instanceData?.enableCategories ?? true,
      includeReview: instanceData?.includeReview ?? true,
      isPrivate: instanceData?.isPrivate ?? false,
      // Instance-level fields
      name: instanceData?.name ?? decisionName ?? '',
      description: instanceData?.description ?? '',
    },
    onSubmit: ({ value }) => {
      setSaveStatus(decisionProfileId, 'saving');
      updateInstance.mutate(
        {
          instanceId,
          name: value.name,
          description: value.description,
          config: {
            hideBudget: value.hideBudget,
          },
        },
        {
          onSuccess: () => markSaved(decisionProfileId),
          onError: () => setSaveStatus(decisionProfileId, 'error'),
        },
      );
    },
  });

  return (
    <div className="size-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        {/* Auto-save handler - subscribes to form values and triggers debounced save */}
        <form.Subscribe
          selector={(state) => state.values}
          children={(values) => {
            debouncedSave(values as OverviewFormData);
            return null;
          }}
        />

        <div className="mx-auto w-full max-w-160 space-y-8 p-4 md:p-8">
          {/* Process Stewardship Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-title-sm">
                {t('Process Overview')}
              </h2>
              <SaveStatusIndicator
                status={saveState.status}
                savedAt={saveState.savedAt}
              />
            </div>

            <form.AppField
              name="steward"
              children={(field) => (
                <field.Select
                  label={t('Who is stewarding this process?')}
                  isRequired
                  placeholder={t('Select')}
                  selectedKey={field.state.value}
                  onSelectionChange={(key) => field.handleChange(key as string)}
                  onBlur={field.handleBlur}
                  description={t(
                    'The organization, coalition, committee or individual responsible for running this process.',
                  )}
                  errorMessage={getFieldErrorMessage(field)}
                >
                  {stewardOptions.map((option) => (
                    <SelectItem key={option.id} id={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            />

            <form.AppField
              name="name"
              children={(field) => (
                <field.TextField
                  label={t('Process Name')}
                  isRequired
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  inputProps={{
                    placeholder: t('My new process'),
                  }}
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />

            <form.AppField
              name="objective"
              children={(field) => (
                <div className="space-y-2">
                  <field.TextField
                    useTextArea
                    label={t(
                      'Define the objective this process will accomplish',
                    )}
                    isRequired
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={field.handleChange}
                    textareaProps={{
                      placeholder: t('Add a broad outcome'),
                    }}
                    errorMessage={getFieldErrorMessage(field)}
                  />
                  <p className="text-sm text-neutral-gray4">
                    {t(
                      'This information appears when participants want to learn more about the process',
                    )}
                  </p>
                </div>
              )}
            />

            <form.AppField
              name="description"
              children={(field) => (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    {t('Description')}
                    <span className="text-functional-red"> *</span>
                  </label>
                  <RichTextEditorWithToolbar
                    content={field.state.value}
                    onChange={field.handleChange}
                    placeholder={t('A description about my process')}
                    toolbarPosition="bottom"
                    className="rounded-md border border-offWhite"
                    editorClassName="min-h-24 p-3"
                  />
                  <p className="text-sm text-neutral-gray4">
                    {t(
                      'This information appears when participants want to learn more about the process',
                    )}
                  </p>
                </div>
              )}
            />

            <form.AppField
              name="budget"
              children={(field) => (
                <div>
                  <NumberField
                    label={t('Total Budget Available')}
                    value={field.state.value ?? null}
                    onChange={(value) => field.handleChange(value ?? undefined)}
                    prefixText="$"
                    inputProps={{
                      placeholder: '0.00',
                    }}
                  />
                  <p className="mt-1 text-sm text-neutral-gray4">
                    {t('The total amount available this funding round.')}
                  </p>
                </div>
              )}
            />

            {/* Toggle Options */}
            <div className="space-y-4">
              <form.AppField
                name="hideBudget"
                children={(field) => (
                  <ToggleRow label={t('Hide budget from members')}>
                    <field.ToggleButton
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      size="small"
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="enableCategories"
                children={(field) => (
                  <ToggleRow
                    label={t('Organize proposals into categories')}
                    tooltip={t(
                      'Group proposals by category to help reviewers and voters navigate submissions',
                    )}
                  >
                    <field.ToggleButton
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      size="small"
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="includeReview"
                children={(field) => (
                  <ToggleRow
                    label={t('Include proposal review phase')}
                    tooltip={t(
                      'Add a review stage where designated reviewers evaluate proposals before voting',
                    )}
                  >
                    <field.ToggleButton
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      size="small"
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="isPrivate"
                children={(field) => (
                  <ToggleRow
                    label={t('Keep this process private')}
                    tooltip={t(
                      'Only invited members can view and participate in this process',
                    )}
                  >
                    <field.ToggleButton
                      isSelected={field.state.value}
                      onChange={field.handleChange}
                      size="small"
                    />
                  </ToggleRow>
                )}
              />
            </div>
          </section>
          <form.SubmitButton>{t('Save')}</form.SubmitButton>
        </div>
      </form>
    </div>
  );
}
