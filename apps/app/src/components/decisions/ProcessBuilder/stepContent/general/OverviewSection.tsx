'use client';

import { Button } from '@op/ui/Button';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { NumberField } from '@op/ui/NumberField';
import { SelectItem } from '@op/ui/Select';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { LuCircleHelp, LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { RichTextEditorWithToolbar } from '@/components/RichTextEditor/RichTextEditorWithToolbar';
import { getFieldErrorMessage, useAppForm } from '@/components/form/utils';

import type { SectionProps } from '../../contentRegistry';

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

// Toggle row component for consistent styling
function ToggleRow({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <span className="text-base">{label}</span>
        {tooltip && (
          <TooltipTrigger>
            <Button unstyled className="text-neutral-gray4">
              <LuCircleHelp className="size-4" />
            </Button>
            <Tooltip>{tooltip}</Tooltip>
          </TooltipTrigger>
        )}
      </div>
      {children}
    </div>
  );
}

export default function OverviewSection({
  decisionId: _decisionId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();

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
      steward: '',
      focusAreas: [] as Option[],
      aims: [''],
      processName: decisionName || '',
      description: '',
      budget: 0 as number | null,
      hideBudget: true as boolean,
      organizeCategories: true as boolean,
      multiPhase: true as boolean,
      includeReview: true as boolean,
      isPrivate: false as boolean,
    } satisfies OverviewFormData,
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
        <div className="mx-auto w-full max-w-160 space-y-8 p-4 md:p-8">
          {/* Process Stewardship Section */}
          <section className="space-y-6">
            <h2 className="font-serif text-xl">{t('Process Stewardship')}</h2>

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
