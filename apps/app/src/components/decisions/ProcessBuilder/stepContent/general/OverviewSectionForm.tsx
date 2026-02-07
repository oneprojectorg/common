'use client';

import { trpc } from '@op/api/client';
import { useDebounce } from '@op/hooks';
import { ComboBox, ComboBoxItem } from '@op/ui/ComboBox';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useMemo, useRef } from 'react';

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
  stewardProfileId: string;
  objective: string;
  name: string;
  description: string;
  budget: number | null;
  hideBudget: boolean;
  enableCategories: boolean;
  includeReview: boolean;
  isPrivate: boolean;
}

// Auto-save component that subscribes to form values
function AutoSaveHandler({
  values,
  decisionProfileId,
  setInstanceData,
  setSaveStatus,
  markSaved,
}: {
  values: OverviewFormData;
  decisionProfileId: string;
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
    setSaveStatus(decisionProfileId, 'saving');
    setInstanceData(decisionProfileId, {
      name: debouncedValues.name,
      description: debouncedValues.description,
      config: {
        stewardProfileId: debouncedValues.stewardProfileId,
        objective: debouncedValues.objective,
        budget: debouncedValues.budget,
        hideBudget: debouncedValues.hideBudget,
        enableCategories: debouncedValues.enableCategories,
        includeReview: debouncedValues.includeReview,
        isPrivate: debouncedValues.isPrivate,
      },
    });

    // Mark as saved with timestamp
    markSaved(decisionProfileId);

    // TODO: Add API mutation here once storage location is decided
  }, [
    debouncedValues,
    decisionProfileId,
    setInstanceData,
    setSaveStatus,
    markSaved,
  ]);

  return null;
}

// Form component - only rendered after Zustand hydration is complete
export function OverviewSectionForm({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();

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

  // Extract config for easier access
  const config = instanceData?.config;

  // Fetch the current user's profiles (individual + organizations)
  const { data: userProfiles } = trpc.account.getUserProfiles.useQuery();
  const profileItems = useMemo(
    () =>
      (userProfiles ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
      })),
    [userProfiles],
  );

  const form = useAppForm({
    defaultValues: {
      // Config fields
      stewardProfileId: config?.stewardProfileId ?? '',
      objective: config?.objective ?? '',
      budget: (config?.budget ?? null) as number | null,
      hideBudget: config?.hideBudget ?? true,
      enableCategories: config?.enableCategories ?? true,
      includeReview: config?.includeReview ?? true,
      isPrivate: config?.isPrivate ?? false,
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
          stewardProfileId: value.stewardProfileId || undefined,
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
        {/* Auto-save handler - subscribes to form values */}
        <form.Subscribe
          selector={(state) => state.values}
          children={(values) => (
            <AutoSaveHandler
              values={values as OverviewFormData}
              decisionProfileId={decisionProfileId}
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
              <h2 className="font-serif text-title-sm">
                {t('Process Overview')}
              </h2>
              <SaveStatusIndicator
                status={saveState.status}
                savedAt={saveState.savedAt}
              />
            </div>

            <form.AppField
              name="stewardProfileId"
              children={(field) => (
                <ComboBox
                  label={t('Who is stewarding this process?')}
                  isRequired
                  selectedKey={field.state.value || null}
                  onSelectionChange={(key) =>
                    field.handleChange((key as string) ?? '')
                  }
                  description={t(
                    'The organization, coalition, committee or individual responsible for running this process.',
                  )}
                  errorMessage={getFieldErrorMessage(field)}
                  items={profileItems}
                >
                  {(item) => (
                    <ComboBoxItem id={item.id} textValue={item.name}>
                      {item.name}
                    </ComboBoxItem>
                  )}
                </ComboBox>
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
