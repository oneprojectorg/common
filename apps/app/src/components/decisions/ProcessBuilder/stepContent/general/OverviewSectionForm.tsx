'use client';

import { useDebounce } from '@op/hooks';
import { Button } from '@op/ui/Button';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { NumberField } from '@op/ui/NumberField';
import { SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';
import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

// Form data type
interface OverviewFormData {
  steward: string;
  focusAreas: Option[];
  aims: string[];
  processName: string;
  description: string;
  budget: number | null;
  hideBudget: boolean;
  organizeCategories: boolean;
  multiPhase: boolean;
  includeReview: boolean;
  isPrivate: boolean;
}

// Auto-save component that subscribes to form values
function AutoSaveHandler({
  values,
  decisionId,
  setInstanceData,
  setSaveStatus,
  markSaved,
}: {
  values: OverviewFormData;
  decisionId: string;
  setInstanceData: (
    id: string,
    data: {
      name?: string;
      description?: string;
      config?: Record<string, unknown>;
    },
  ) => void;
  setSaveStatus: (
    id: string,
    status: 'idle' | 'saving' | 'saved' | 'error',
  ) => void;
  markSaved: (id: string) => void;
}) {
  const [debouncedValues] = useDebounce(values, AUTOSAVE_DEBOUNCE_MS);
  const isInitialMount = useRef(true);
  const previousValues = useRef<string | null>(null);

  useEffect(() => {
    const valuesString = JSON.stringify(debouncedValues);

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousValues.current = valuesString;
      return;
    }

    // Skip if values haven't changed
    if (valuesString === previousValues.current) {
      return;
    }
    previousValues.current = valuesString;

    // Update Zustand store (persists to localStorage)
    setSaveStatus(decisionId, 'saving');
    setInstanceData(decisionId, {
      name: debouncedValues.processName,
      description: debouncedValues.description,
      config: {
        steward: debouncedValues.steward,
        focusAreas: debouncedValues.focusAreas,
        aims: debouncedValues.aims,
        budget: debouncedValues.budget,
        hideBudget: debouncedValues.hideBudget,
        organizeCategories: debouncedValues.organizeCategories,
        multiPhase: debouncedValues.multiPhase,
        includeReview: debouncedValues.includeReview,
        isPrivate: debouncedValues.isPrivate,
      },
    });

    // Mark as saved with timestamp
    markSaved(decisionId);

    // TODO: Add API mutation here once storage location is decided
  }, [debouncedValues, decisionId, setInstanceData, setSaveStatus, markSaved]);

  return null;
}

// Form component - only rendered after Zustand hydration is complete
export function OverviewSectionForm({
  decisionId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();

  // Zustand store - using new instanceData structure
  const instanceData = useProcessBuilderStore((s) => s.instances[decisionId]);
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const saveState = useProcessBuilderStore((s) => s.getSaveState(decisionId));
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);

  // Extract config for easier access
  const config = instanceData?.config;

  // Mock options - these would come from API
  const stewardOptions = [
    { id: 'one-project', label: 'One Project' },
    { id: 'committee', label: 'Committee' },
    { id: 'coalition', label: 'Coalition' },
  ];

  const focusAreaOptions: Option[] = [
    { id: 'money-finance', label: 'Money & Finance' },
    { id: 'governance', label: 'Governance' },
    { id: 'community', label: 'Community' },
    { id: 'environment', label: 'Environment' },
    { id: 'technology', label: 'Technology' },
  ];

  const form = useAppForm({
    defaultValues: {
      // Config fields
      steward: config?.steward ?? '',
      focusAreas: config?.focusAreas ?? [],
      aims: config?.aims ?? [''],
      budget: (config?.budget ?? null) as number | null,
      hideBudget: config?.hideBudget ?? true,
      organizeCategories: config?.organizeCategories ?? true,
      multiPhase: config?.multiPhase ?? true,
      includeReview: config?.includeReview ?? true,
      isPrivate: config?.isPrivate ?? false,
      // Instance-level fields
      processName: instanceData?.name ?? decisionName ?? '',
      description: instanceData?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      // TODO: Submit to API
      console.log('Form submitted:', value);
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
        {/* Auto-save handler - subscribes to form values */}
        <form.Subscribe
          selector={(state) => state.values}
          children={(values) => (
            <AutoSaveHandler
              values={values as OverviewFormData}
              decisionId={decisionId}
              setInstanceData={setInstanceData}
              setSaveStatus={setSaveStatus}
              markSaved={markSaved}
            />
          )}
        />

        <div className="mx-auto w-full max-w-160 space-y-8 p-4 md:p-8">
          {/* Process Stewardship Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl">{t('Process Stewardship')}</h2>
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
              name="focusAreas"
              children={(field) => (
                <div className="space-y-2">
                  <field.MultiSelectComboBox
                    label={t('Primary focus areas')}
                    isRequired
                    placeholder={t('Search focus areas')}
                    items={focusAreaOptions}
                    value={field.state.value}
                    onChange={field.handleChange}
                    errorMessage={getFieldErrorMessage(field)}
                  />
                  <p className="text-sm text-neutral-gray4">
                    {t('Select the strategic areas this process advances')}
                  </p>
                </div>
              )}
            />

            <form.AppField
              name="aims"
              children={(field) => {
                const aims = field.state.value;

                const handleAddAim = () => {
                  field.handleChange([...aims, '']);
                };

                const handleAimChange = (index: number, value: string) => {
                  const newAims = [...aims];
                  newAims[index] = value;
                  field.handleChange(newAims);
                };

                const handleRemoveAim = (index: number) => {
                  if (aims.length > 1) {
                    const newAims = aims.filter((_, i) => i !== index);
                    field.handleChange(newAims);
                  }
                };

                return (
                  <div className="space-y-2">
                    {aims.map((aim, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="flex-1">
                          <field.TextField
                            label={
                              index === 0
                                ? t('Specific aim (optional)')
                                : undefined
                            }
                            value={aim}
                            onChange={(value) => handleAimChange(index, value)}
                            inputProps={{
                              placeholder: t(
                                'e.g., Establish and/or support mutual aid infrastructure',
                              ),
                            }}
                          />
                        </div>
                        {aims.length > 1 && (
                          <Button
                            unstyled
                            className="mb-2 p-2 text-neutral-gray4 hover:text-neutral-charcoal"
                            onPress={() => handleRemoveAim(index)}
                          >
                            <LuX className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className="text-sm text-neutral-gray4">
                      {t(
                        'Add a concrete, measurable goal this process works toward',
                      )}
                    </p>

                    <Button
                      color="ghost"
                      unstyled
                      className="flex items-center gap-1 text-primary-teal"
                      onPress={handleAddAim}
                    >
                      <LuPlus className="size-4" />
                      {t('Add another aim')}
                    </Button>
                  </div>
                );
              }}
            />
          </section>

          <hr className="border-neutral-gray1" />

          {/* Process Details Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-serif text-xl">{t('Process Details')}</h2>
              <p className="mt-1 text-sm text-neutral-gray4">
                {t('Define the key details for your decision process.')}
              </p>
            </div>

            <form.AppField
              name="processName"
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
                    value={field.state.value}
                    onChange={field.handleChange}
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
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="organizeCategories"
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
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="multiPhase"
                children={(field) => (
                  <ToggleRow
                    label={t('Set up multi-phase timeline')}
                    tooltip={t(
                      'Create distinct phases for submission, review, and voting periods',
                    )}
                  >
                    <field.ToggleButton
                      isSelected={field.state.value}
                      onChange={field.handleChange}
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
                    />
                  </ToggleRow>
                )}
              />
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
