'use client';

import { trpc } from '@op/api/client';
import { getCurrencySymbol, getProcessBudget } from '@op/common/client';
import { Header1, Header3 } from '@op/sense/Header';
import { NumberField } from '@op/sense/NumberField';
import { Switch } from '@op/sense/Switch';
import { useEffect, useId, useMemo, useRef } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { isSavableProcessBudget } from '@/components/decisions/ProcessBuilder/processBudgetPatch';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';
import { getTemplateCurrency } from '@/components/decisions/proposalTemplate';
import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';
import { ToggleRow } from '@/components/layout/split/form/ToggleRow';

const createProcessSettingsValidator = (t: TranslateFn) =>
  z.object({
    stewardProfileId: z.string(),
    name: z
      .string({ message: t('decisions.processBuilder.processNamePlaceholder') })
      .min(1, {
        message: t('decisions.processBuilder.processNamePlaceholder'),
      }),
    description: z
      .string({
        message: t('decisions.processBuilder.processDescriptionPlaceholder'),
      })
      .min(1, {
        message: t('decisions.processBuilder.processDescriptionPlaceholder'),
      }),
    totalBudget: z
      .number({ message: t('decisions.processBuilder.totalBudgetHint') })
      .positive({ message: t('decisions.processBuilder.totalBudgetHint') })
      .nullable(),
    hideBudget: z.boolean(),
    organizeByCategories: z.boolean(),
    requireCollaborativeProposals: z.boolean(),
    isPrivate: z.boolean(),
  });

// Form data type
type ProcessSettingsFormData = z.infer<
  ReturnType<typeof createProcessSettingsValidator>
>;

// Watches form values and triggers debounced save on changes
function FormValueWatcher({
  values,
  onValuesChange,
}: {
  values: ProcessSettingsFormData;
  onValuesChange: (values: ProcessSettingsFormData) => void;
}) {
  const isInitialMount = useRef(true);
  const previousValues = useRef<string | null>(null);

  useEffect(() => {
    const valuesString = JSON.stringify(values);

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
    onValuesChange(values);
  }, [values, onValuesChange]);

  return null;
}

// Form component - only rendered after Zustand hydration is complete
export function ProcessSettingsForm({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const instanceData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const { saveChanges, autosaveStatus } = useProcessBuilderAutosave();

  // Fetch the current user's profiles (individual + organizations)
  const { data: userProfilesData } = trpc.account.getUserProfiles.useQuery();
  const userProfiles = userProfilesData?.items;
  const profileItems = (userProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Ensure the current steward appears in the dropdown so the Select can
  // render its name — even when the viewer isn't the owner and their own
  // profile list doesn't include the steward.
  if (
    instance.steward &&
    !profileItems.some((p) => p.id === instance.steward?.id)
  ) {
    profileItems.push({
      id: instance.steward.id,
      name: instance.steward.name ?? '',
    });
  }

  // Only the process owner can change the steward
  const isProcessOwner = userProfiles?.some((p) => p.id === instance.owner?.id);

  const storePhases = instanceData?.phases;
  const apiPhasesSource = instance.instanceData?.phases;
  const phases = useMemo(() => {
    const apiPhases = apiPhasesSource ?? [];
    return (storePhases ?? apiPhases).map((phase) => ({
      ...phase,
      settings:
        phase.settings ??
        apiPhases.find((apiPhase) => apiPhase.phaseId === phase.phaseId)
          ?.settings,
    }));
  }, [storePhases, apiPhasesSource]);
  const pendingBudget = instanceData?.processBudget;
  const currentBudget =
    pendingBudget !== undefined
      ? pendingBudget
      : (getProcessBudget({ phases, currentPhaseId: null }) ?? null);
  const budgetCurrency = getTemplateCurrency(
    instanceData?.proposalTemplate ?? instance.instanceData?.proposalTemplate,
  );
  const totalBudgetId = useId();

  const handleValuesChange = (values: ProcessSettingsFormData) => {
    saveChanges({
      name: values.name,
      description: values.description,
      stewardProfileId: isProcessOwner
        ? values.stewardProfileId || undefined
        : undefined,
      config: {
        hideBudget: values.hideBudget,
        organizeByCategories: values.organizeByCategories,
        requireCollaborativeProposals: values.requireCollaborativeProposals,
        isPrivate: values.isPrivate,
      },
      ...(isSavableProcessBudget(values.totalBudget) &&
        values.totalBudget !== currentBudget && {
          processBudget: values.totalBudget,
        }),
    });
  };

  // Prefer the store's merged view over API data — saveChanges writes it
  // synchronously on every edit, so it's always the freshest source.
  const initialStewardProfileId =
    instanceData?.stewardProfileId ?? instance.steward?.id ?? '';
  const initialName = instanceData?.name ?? decisionName ?? '';
  const initialDescription =
    instanceData?.description ?? instance.description ?? '';

  const form = useAppForm({
    defaultValues: {
      stewardProfileId: initialStewardProfileId,
      name: initialName,
      description: initialDescription,
      totalBudget: currentBudget,
      hideBudget: instanceData?.config?.hideBudget ?? false,
      organizeByCategories: instanceData?.config?.organizeByCategories ?? true,
      requireCollaborativeProposals:
        instanceData?.config?.requireCollaborativeProposals ?? false,
      isPrivate: instanceData?.config?.isPrivate ?? false,
    },
    validators: {
      onBlur: createProcessSettingsValidator(t),
      onChange: createProcessSettingsValidator(t),
    },
  });

  return (
    <div className="size-full [scrollbar-gutter:stable]">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {/* Watch form values and trigger debounced save */}
        <form.Subscribe
          selector={(state) => state.values}
          children={(values) => (
            <FormValueWatcher
              values={values as ProcessSettingsFormData}
              onValuesChange={handleValuesChange}
            />
          )}
        />

        <div className="mx-auto w-full space-y-8 p-4 md:max-w-160 md:p-8">
          {/* Process Settings Section */}
          <section className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <Header1 className="text-headline">
                  {t('decisions.processBuilder.processSettingsSectionLabel')}
                </Header1>
                <SaveStatusIndicator
                  status={autosaveStatus.status}
                  savedAt={autosaveStatus.savedAt}
                />
              </div>
              <p className="mt-2 text-muted-foreground">
                {t('decisions.processBuilder.processSettingsHint')}
              </p>
            </div>

            <form.AppField
              name="stewardProfileId"
              children={(field) => (
                <field.Select
                  label={t('decisions.processBuilder.stewardQuestion')}
                  placeholder={t('Select')}
                  disabled={!isProcessOwner}
                  description={t('decisions.processBuilder.stewardHint')}
                  options={profileItems.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
              )}
            />

            <form.AppField
              name="name"
              children={(field) => (
                <field.TextField
                  label={t('decisions.processBuilder.processNameLabel')}
                  isRequired
                  placeholder={t('decisions.processBuilder.processNameExample')}
                  maxLength={50}
                />
              )}
            />

            <form.AppField
              name="description"
              children={(field) => (
                <field.TextArea
                  label={t('Description')}
                  isRequired
                  placeholder={t(
                    'decisions.processBuilder.processDescriptionExample',
                  )}
                  maxLength={250}
                  description={t('decisions.processBuilder.processAboutHint')}
                />
              )}
            />

            <form.AppField
              name="totalBudget"
              children={(field) => (
                <NumberField
                  id={totalBudgetId}
                  label={t('decisions.processBuilder.totalBudgetLabel')}
                  description={t('decisions.processBuilder.totalBudgetHint')}
                  prefixText={getCurrencySymbol(budgetCurrency)}
                  value={field.state.value}
                  onChange={(next) => field.handleChange(next)}
                  onBlur={field.handleBlur}
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />

            {/* Toggle Options */}
            <div className="space-y-4">
              <form.AppField
                name="hideBudget"
                children={(field) => (
                  <ToggleRow
                    label={t('decisions.processBuilder.hideBudgetLabel')}
                    description={t('decisions.processBuilder.hideBudgetHint')}
                  >
                    <field.Switch />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="organizeByCategories"
                children={(field) => (
                  <ToggleRow
                    label={t(
                      'decisions.processBuilder.organizeCategoriesLabel',
                    )}
                    description={t(
                      'decisions.processBuilder.organizeCategoriesHint',
                    )}
                  >
                    <Switch
                      checked={!!field.state.value}
                      onCheckedChange={(value) => {
                        field.handleChange(value);
                        // Write to store immediately so the sidebar
                        // hides/shows "Proposal Categories" without waiting
                        // for the debounced save.
                        saveChanges({
                          config: { organizeByCategories: value },
                        });
                      }}
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="requireCollaborativeProposals"
                children={(field) => (
                  <ToggleRow
                    label={t(
                      'decisions.processBuilder.requireCollaborativeProposalsLabel',
                    )}
                    description={t(
                      'decisions.processBuilder.requireCollaborativeProposalsHint',
                    )}
                  >
                    <field.Switch />
                  </ToggleRow>
                )}
              />
            </div>
          </section>

          {/* Visibility Section */}
          <section className="space-y-6">
            <Header3>{t('decisions.processBuilder.visibilityLabel')}</Header3>

            <form.AppField
              name="isPrivate"
              children={(field) => (
                <ToggleRow
                  label={t('decisions.openForLearningLabel')}
                  description={t('decisions.processBuilder.visibilityOpenHint')}
                >
                  <Switch
                    checked={!field.state.value}
                    onCheckedChange={(value) => field.handleChange(!value)}
                  />
                </ToggleRow>
              )}
            />
          </section>
        </div>
      </form>
    </div>
  );
}
