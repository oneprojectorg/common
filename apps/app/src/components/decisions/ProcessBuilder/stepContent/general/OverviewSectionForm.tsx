'use client';

import { trpc } from '@op/api/client';
import { useDebouncedCallback } from '@op/hooks';
import { SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

const createOverviewValidator = (t: (key: string) => string) =>
  z.object({
    stewardProfileId: z
      .string({ message: t('Select a steward for this process') })
      .min(1, { message: t('Select a steward for this process') }),
    name: z
      .string({ message: t('Enter a process name') })
      .min(1, { message: t('Enter a process name') }),
    description: z
      .string({ message: t('Enter a description') })
      .min(1, { message: t('Enter a description') }),
    organizeByCategories: z.boolean(),
    requireCollaborativeProposals: z.boolean(),
    isPrivate: z.boolean(),
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
  const utils = trpc.useUtils();

  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const isDraft = instance.status === 'draft';

  // Store: used as a localStorage buffer for non-draft edits only
  const instanceData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);

  // Reset stale save status from previous sessions
  useEffect(() => {
    setSaveStatus(decisionProfileId, 'idle');
  }, [decisionProfileId, setSaveStatus]);

  // tRPC mutation with cache invalidation (matches phase editor pattern)
  const debouncedSaveRef = useRef<() => boolean>(null);
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: () => setSaveStatus(decisionProfileId, 'error'),
    onSettled: () => {
      // Skip invalidation if another debounced save is pending — that save's
      // onSettled will reconcile. This prevents a stale refetch from overwriting
      // optimistic cache updates made between the two saves.
      if (debouncedSaveRef.current?.()) {
        return;
      }
      void utils.decision.getInstance.invalidate({ instanceId });
    },
  });

  // Fetch the current user's profiles (individual + organizations)
  const { data: userProfiles } = trpc.account.getUserProfiles.useQuery();
  const profileItems = (userProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Debounced save: draft persists to API; non-draft only buffers locally.
  const debouncedSave = useDebouncedCallback((values: OverviewFormData) => {
    setSaveStatus(decisionProfileId, 'saving');

    // Always buffer in the store so the UI reflects the latest values.
    // For non-draft this also persists to localStorage as an offline buffer.
    setInstanceData(decisionProfileId, {
      name: values.name,
      description: values.description,
      stewardProfileId: values.stewardProfileId,
      config: {
        organizeByCategories: values.organizeByCategories,
        requireCollaborativeProposals: values.requireCollaborativeProposals,
        isPrivate: values.isPrivate,
      },
    });

    if (isDraft) {
      updateInstance.mutate({
        instanceId,
        name: values.name,
        description: values.description,
        stewardProfileId: values.stewardProfileId || undefined,
        config: {
          organizeByCategories: values.organizeByCategories,
          requireCollaborativeProposals: values.requireCollaborativeProposals,
          isPrivate: values.isPrivate,
        },
      });
    } else {
      markSaved(decisionProfileId);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
  debouncedSaveRef.current = () => debouncedSave.isPending();

  // Prefer store (localStorage buffer) over API data — the store is written
  // synchronously on every save, so it's always the freshest source.
  const initialStewardProfileId =
    instanceData?.stewardProfileId ?? instance.steward?.id ?? '';
  const initialName = instanceData?.name ?? instance.name ?? decisionName ?? '';
  const initialDescription =
    instanceData?.description ?? instance.description ?? '';

  const form = useAppForm({
    defaultValues: {
      stewardProfileId: initialStewardProfileId,
      name: initialName,
      description: initialDescription,
      organizeByCategories: instanceData?.config?.organizeByCategories ?? true,
      requireCollaborativeProposals:
        instanceData?.config?.requireCollaborativeProposals ?? true,
      isPrivate: instanceData?.config?.isPrivate ?? false,
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
              onValuesChange={debouncedSave}
            />
          )}
        />

        <div className="mx-auto w-full space-y-8 p-4 md:max-w-160 md:p-8">
          {/* Process Overview Section */}
          <section className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-title-sm">
                  {t('Process Overview')}
                </h2>
                <SaveStatusIndicator
                  status={saveState.status}
                  savedAt={saveState.savedAt}
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
                  isRequired
                  placeholder={t('Select')}
                  selectedKey={field.state.value || null}
                  onSelectionChange={(key) => field.handleChange(key as string)}
                  onBlur={field.handleBlur}
                  description={t(
                    'The organization, coalition, committee or individual responsible for running this process.',
                  )}
                  errorMessage={getFieldErrorMessage(field)}
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
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />

            <form.AppField
              name="description"
              children={(field) => (
                <div className="space-y-2">
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

            {/* Toggle Options */}
            <div className="space-y-8">
              <form.AppField
                name="organizeByCategories"
                children={(field) => (
                  <ToggleRow
                    label={t('Organize proposals into categories')}
                    tooltip={t(
                      'Group proposals into categories for better organization and evaluation',
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
                name="requireCollaborativeProposals"
                children={(field) => (
                  <ToggleRow
                    label={t('Require collaborative proposals')}
                    tooltip={t(
                      'Require proposals to be co-authored by multiple participants',
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
            <h2 className="font-serif text-title-sm">{t('Visibility')}</h2>

            <form.AppField
              name="isPrivate"
              children={(field) => (
                <ToggleRow
                  label={t('Keep this process private')}
                  tooltip={t(
                    'Only invited participants can view and participate in this process',
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
