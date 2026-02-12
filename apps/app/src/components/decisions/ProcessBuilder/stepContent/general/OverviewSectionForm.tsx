'use client';

import { trpc } from '@op/api/client';
import { useDebouncedCallback } from '@op/hooks';
import { SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

import { SaveStatusIndicator } from '../../components/SaveStatusIndicator';
import { ToggleRow } from '../../components/ToggleRow';
import type { SectionProps } from '../../contentRegistry';
import { useProcessBuilderStore } from '../../stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

// Form data type
interface OverviewFormData {
  stewardProfileId: string;
  name: string;
  description: string;
  organizeByCategories: boolean;
  requireCollaborativeProposals: boolean;
  isPrivate: boolean;
}

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
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: () => setSaveStatus(decisionProfileId, 'error'),
    onSettled: () => {
      void utils.decision.getInstance.invalidate({ instanceId });
    },
  });

  // Fetch the current user's profiles (individual + organizations)
  const { data: userProfiles } = trpc.account.getUserProfiles.useQuery();
  const profileItems = (userProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));

  // Debounced save: always persist to localStorage, additionally to API for drafts
  const debouncedSave = useDebouncedCallback((values: OverviewFormData) => {
    setSaveStatus(decisionProfileId, 'saving');

    // Always save to localStorage
    setInstanceData(decisionProfileId, {
      name: values.name,
      description: values.description,
      stewardProfileId: values.stewardProfileId,
      organizeByCategories: values.organizeByCategories,
      requireCollaborativeProposals: values.requireCollaborativeProposals,
      isPrivate: values.isPrivate,
    });
    markSaved(decisionProfileId);

    if (isDraft) {
      // Draft: also persist to API
      updateInstance.mutate({
        instanceId,
        name: values.name,
        description: values.description,
        stewardProfileId: values.stewardProfileId || undefined,
      });
    }
  }, AUTOSAVE_DEBOUNCE_MS);

  // Non-draft: prefer store (localStorage buffer) over API data.
  // Draft: use API data (query cache kept fresh via onSettled invalidation).
  const initialName =
    !isDraft && instanceData?.name
      ? instanceData.name
      : (instance.name ?? decisionName ?? '');
  const initialDescription =
    !isDraft && instanceData?.description
      ? instanceData.description
      : (instance.description ?? '');

  const form = useAppForm({
    defaultValues: {
      stewardProfileId: instanceData?.stewardProfileId ?? '',
      name: initialName,
      description: initialDescription,
      organizeByCategories: instanceData?.organizeByCategories ?? true,
      requireCollaborativeProposals:
        instanceData?.requireCollaborativeProposals ?? true,
      isPrivate: instanceData?.isPrivate ?? false,
    },
  });

  return (
    <div className="size-full">
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

        <div className="mx-auto w-full max-w-160 space-y-8 p-4 md:p-8">
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
          </section>
        </div>
      </form>
    </div>
  );
}
