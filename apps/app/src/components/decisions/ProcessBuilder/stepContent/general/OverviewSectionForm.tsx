'use client';

import { trpc } from '@op/api/client';
import { Header2 } from '@op/ui/Header';
import { SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import { useProcessBuilderAutosave } from '@/components/decisions/ProcessBuilder/ProcessBuilderAutosaveContext';
import { SaveStatusIndicator } from '@/components/decisions/ProcessBuilder/components/SaveStatusIndicator';
import { ToggleRow } from '@/components/decisions/ProcessBuilder/components/ToggleRow';
import type { SectionProps } from '@/components/decisions/ProcessBuilder/contentRegistry';
import { useProcessBuilderStore } from '@/components/decisions/ProcessBuilder/stores/useProcessBuilderStore';
import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

const createOverviewValidator = (t: TranslateFn) =>
  z.object({
    stewardProfileId: z.string(),
    name: z
      .string({ message: t('Enter a process name') })
      .min(1, { message: t('Enter a process name') }),
    description: z
      .string({ message: t('Enter a description') })
      .min(1, { message: t('Enter a description') }),
    organizeByCategories: z.boolean(),
    requireCollaborativeProposals: z.boolean(),
    isPrivate: z.boolean(),
    defaultProposalsHidden: z.boolean(),
  });

// Form data type
type OverviewFormData = z.infer<ReturnType<typeof createOverviewValidator>>;

// Watches form values and triggers debounced save on changes
function FormValueWatcher({
  values,
  onValuesChange,
}: {
  values: OverviewFormData;
  onValuesChange: (values: OverviewFormData) => void;
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
export function OverviewSectionForm({
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
  const { data: userProfiles } = trpc.account.getUserProfiles.useQuery();
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

  const handleValuesChange = (values: OverviewFormData) => {
    saveChanges({
      name: values.name,
      description: values.description,
      stewardProfileId: isProcessOwner
        ? values.stewardProfileId || undefined
        : undefined,
      config: {
        organizeByCategories: values.organizeByCategories,
        requireCollaborativeProposals: values.requireCollaborativeProposals,
        isPrivate: values.isPrivate,
        defaultProposalsHidden: values.defaultProposalsHidden,
      },
    });
  };

  // Prefer store (localStorage buffer) over API data — the store is written
  // synchronously on every save, so it's always the freshest source.
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
      organizeByCategories: instanceData?.config?.organizeByCategories ?? true,
      requireCollaborativeProposals:
        instanceData?.config?.requireCollaborativeProposals ?? false,
      isPrivate: instanceData?.config?.isPrivate ?? false,
      defaultProposalsHidden:
        instanceData?.config?.defaultProposalsHidden ?? false,
    },
    validators: {
      onBlur: createOverviewValidator(t),
      onChange: createOverviewValidator(t),
    },
  });

  return (
    <div className="size-full [scrollbar-gutter:stable]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {/* Watch form values and trigger debounced save */}
        <form.Subscribe
          selector={(state) => state.values}
          children={(values) => (
            <FormValueWatcher
              values={values as OverviewFormData}
              onValuesChange={handleValuesChange}
            />
          )}
        />

        <div className="mx-auto w-full space-y-8 p-4 md:max-w-160 md:p-8">
          {/* Process Overview Section */}
          <section className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <Header2 className="font-serif text-title-sm">
                  {t('Process Overview')}
                </Header2>
                <SaveStatusIndicator
                  status={autosaveStatus.status}
                  savedAt={autosaveStatus.savedAt}
                />
              </div>
              <p className="mt-2 text-neutral-gray4">
                {t('Define the key details for your decision process.')}
              </p>
            </div>

            <form.AppField
              name="stewardProfileId"
              children={(field) => (
                <field.Select
                  label={t('Who is stewarding this process?')}
                  placeholder={t('Select')}
                  isDisabled={!isProcessOwner}
                  selectedKey={field.state.value || null}
                  onSelectionChange={(key) => field.handleChange(key as string)}
                  onBlur={field.handleBlur}
                  description={t(
                    'The organization, coalition, committee or individual responsible for running this process. Only the process owner can change the steward.',
                  )}
                  errorMessage={getFieldErrorMessage(field, {
                    requireBlur: true,
                  })}
                >
                  {profileItems.map((item) => (
                    <SelectItem key={item.id} id={item.id}>
                      {item.name}
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
                  errorMessage={getFieldErrorMessage(field, {
                    requireBlur: true,
                  })}
                  maxLength={50}
                />
              )}
            />

            <form.AppField
              name="description"
              children={(field) => (
                <field.TextField
                  useTextArea
                  label={t('Description')}
                  isRequired
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  textareaProps={{
                    placeholder: t('A description about my process'),
                  }}
                  errorMessage={getFieldErrorMessage(field, {
                    requireBlur: true,
                  })}
                  maxLength={250}
                  description={t(
                    'This information appears when participants want to learn more about the process',
                  )}
                />
              )}
            />

            {/* Toggle Options */}
            <div className="space-y-4">
              <form.AppField
                name="organizeByCategories"
                children={(field) => (
                  <ToggleRow
                    label={t('Organize proposals into categories')}
                    description={t(
                      'Group proposals into categories for better organization and evaluation.',
                    )}
                  >
                    <field.ToggleButton
                      isSelected={field.state.value}
                      onChange={(value) => {
                        field.handleChange(value);
                        // Write to store immediately so the sidebar
                        // hides/shows "Proposal Categories" without waiting
                        // for the debounced save.
                        saveChanges({
                          config: { organizeByCategories: value },
                        });
                      }}
                      size="small"
                    />
                  </ToggleRow>
                )}
              />

              <form.AppField
                name="requireCollaborativeProposals"
                children={(field) => (
                  <ToggleRow
                    label={t('Require collaborative proposals')}
                    description={t(
                      'Require proposals to be co-authored by at least 2 participants.',
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

          {/* Visibility Section */}
          <section className="space-y-6">
            <Header2 className="font-serif text-title-sm">
              {t('Visibility')}
            </Header2>

            <form.AppField
              name="isPrivate"
              children={(field) => (
                <ToggleRow
                  label={t('Open for learning')}
                  description={t(
                    'Anyone on Common can view this process. Only invited participants can submit.',
                  )}
                >
                  <field.ToggleButton
                    isSelected={!field.state.value}
                    onChange={(value) => field.handleChange(!value)}
                    size="small"
                  />
                </ToggleRow>
              )}
            />

            <form.AppField
              name="defaultProposalsHidden"
              children={(field) => (
                <ToggleRow
                  label={t('Hide proposals by default')}
                  description={t(
                    'New proposals are hidden from other participants until an admin makes them visible.',
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
          </section>
        </div>
      </form>
    </div>
  );
}
