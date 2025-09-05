import { parseDate } from '@internationalized/date';
import { CategoryList } from '@op/ui/CategoryList';
import { Checkbox } from '@op/ui/Checkbox';
import { DatePicker } from '@op/ui/DatePicker';
import { Description } from '@op/ui/Field';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { formatDate as formatDateCore } from '@op/ui/utils/formatting';
import { WidgetProps } from '@rjsf/utils';
import React from 'react';

import { RichTextEditor } from '../../RichTextEditor';

// Higher-order component to wrap widgets with error boundaries
const withWidgetErrorBoundary = <P extends WidgetProps>(
  WrappedWidget: React.ComponentType<P>,
  widgetName: string,
) => {
  return class extends React.Component<P, { hasError: boolean }> {
    constructor(props: P) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error(`Widget error in ${widgetName}:`, error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="rounded border border-functional-red/20 bg-functional-red/5 p-3">
            <p className="text-sm text-functional-red">
              Error rendering {widgetName} widget
            </p>
            <p className="mt-1 text-xs text-neutral-gray4">
              Field: {this.props.schema?.title || 'Unknown'}
            </p>
          </div>
        );
      }

      return <WrappedWidget {...this.props} />;
    }
  };
};

export const TextWidget = (props: WidgetProps) => {
  const {
    id,
    value,
    required,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema,
    rawErrors,
  } = props;
  const inputType = schema.format === 'email' ? 'email' : 'text';
  const customClassName = uiSchema?.['ui:options']?.className as string;

  return (
    <TextField
      id={id}
      label={schema.title || ''}
      value={value || ''}
      isRequired={required}
      inputProps={{
        placeholder: uiSchema?.['ui:placeholder'] || placeholder,
        type: inputType,
      }}
      description={schema.description}
      onChange={(val) => onChange(val)}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      errorMessage={rawErrors?.join(', ')}
      isInvalid={!!rawErrors && rawErrors.length > 0}
      className={customClassName}
    />
  );
};

export const TextareaWidget = (props: WidgetProps) => {
  const {
    id,
    value,
    required,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema,
    rawErrors,
  } = props;
  const customClassName = uiSchema?.['ui:options']?.className as string;

  return (
    <TextField
      id={id}
      label={schema.title || ''}
      value={value || ''}
      isRequired={required}
      useTextArea
      textareaProps={{
        placeholder: uiSchema?.['ui:placeholder'] || placeholder,
      }}
      description={schema.description}
      onChange={(val) => onChange(val)}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
      errorMessage={rawErrors?.join(', ')}
      isInvalid={!!rawErrors && rawErrors.length > 0}
      className={customClassName}
    />
  );
};

export const DateWidget = (props: WidgetProps) => {
  const {
    id,
    value,
    required,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema,
    rawErrors,
  } = props;
  const customClassName = uiSchema?.['ui:options']?.className as string;

  // Helper function to create a proper DateValue object from ISO string
  const parseISOString = (isoString: string) => {
    if (!isoString?.trim()) return undefined;

    try {
      // Use parseDate directly - it handles ISO format validation internally
      return parseDate(isoString.trim());
    } catch (error) {
      console.warn('DateWidget: Failed to parse date value:', isoString, error);
      return undefined;
    }
  };

  const dateValue = parseISOString(value as string);

  const handleDateChange = (newDateValue: any) => {
    if (
      newDateValue &&
      newDateValue.year &&
      newDateValue.month &&
      newDateValue.day
    ) {
      // Convert the DateValue to ISO string format for the form
      const isoString = `${newDateValue.year}-${String(newDateValue.month).padStart(2, '0')}-${String(newDateValue.day).padStart(2, '0')}`;
      onChange(isoString);
    } else {
      onChange('');
    }
  };

  // Add date range validation
  const validateDateRanges = (selectedDate: string): string[] => {
    const errors: string[] = [];
    if (!selectedDate) {
      return errors;
    }

    try {
      const selected = new Date(selectedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if date is valid
      if (isNaN(selected.getTime())) {
        errors.push('Invalid date format');
        return errors;
      }

      // Dates should be within reasonable future range (2 years)
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      if (selected > twoYearsFromNow) {
        errors.push('Date cannot be more than 2 years in the future');
      }
    } catch (error) {
      errors.push('Invalid date');
    }

    return errors;
  };

  // Combine RJSF validation errors with our custom validation
  const allErrors = [
    ...(rawErrors || []),
    ...validateDateRanges(value as string),
  ];

  try {
    return (
      <DatePicker
        label={schema.title || ''}
        value={dateValue as any}
        isRequired={required}
        placeholder="Select date"
        description={schema.description}
        onChange={handleDateChange}
        errorMessage={allErrors.length > 0 ? allErrors.join(', ') : undefined}
        inputProps={{
          onBlur: () => onBlur(id, value),
          onFocus: () => onFocus(id, value),
        }}
        className={customClassName}
      />
    );
  } catch (error) {
    console.error(
      'DateWidget render error:',
      error,
      'value:',
      value,
      'dateValue:',
      dateValue,
    );
    return (
      <div className="rounded border border-functional-red/20 bg-functional-red/5 p-3">
        <p className="text-sm text-functional-red">
          Date widget error:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <p className="mt-1 text-xs text-neutral-gray4">
          Value: {JSON.stringify(value)} | Parsed: {JSON.stringify(dateValue)}
        </p>
      </div>
    );
  }
};

export const CheckboxWidget = (props: WidgetProps) => {
  const { id, value, onChange, schema, uiSchema } = props;
  const customClassName = uiSchema?.['ui:options']?.className as string;

  return (
    <Checkbox
      id={id}
      isSelected={value || false}
      onChange={(val) => onChange(val)}
      className={customClassName}
    >
      {schema.title}
    </Checkbox>
  );
};

export const RadioWidget = (props: WidgetProps) => {
  const { value, onChange, schema, options, uiSchema } = props;
  const { enumOptions } = options;
  const customClassName = uiSchema?.['ui:options']?.className as string;

  return (
    <div className={cn('flex flex-col gap-2', customClassName)}>
      <label className="text-sm font-medium text-neutral-charcoal">
        {schema.title}
      </label>
      <RadioGroup
        value={value || ''}
        onChange={(val) => onChange(val)}
        aria-label={schema.title || ''}
      >
        {enumOptions?.map((option: any) => (
          <Radio key={option.value} value={option.value}>
            <span className="text-sm">{option.label}</span>
          </Radio>
        ))}
      </RadioGroup>
      {schema.description && (
        <p className="text-xs text-neutral-gray4">{schema.description}</p>
      )}
    </div>
  );
};

export const NumberWidget = (props: WidgetProps) => {
  const {
    id,
    value,
    required,
    placeholder,
    onChange,
    onBlur,
    onFocus,
    schema,
    uiSchema,
    rawErrors,
  } = props;
  const customClassName = uiSchema?.['ui:options']?.className as string;

  const handleChange = (numericValue: number | null) => {
    onChange(numericValue);
  };

  // Show dollar prefix for currency format
  const isCurrency = schema.format === 'currency';

  return (
    <NumberField
      id={id}
      label={schema.title || ''}
      value={value || null}
      isRequired={required}
      prefixText={isCurrency ? '$' : undefined}
      inputProps={{
        placeholder: uiSchema?.['ui:placeholder'] || placeholder,
        onBlur: () => onBlur(id, value),
        onFocus: () => onFocus(id, value),
      }}
      description={schema.description}
      onChange={handleChange}
      errorMessage={rawErrors?.join(', ')}
      className={customClassName}
    />
  );
};

export const CategoryListWidget = (props: WidgetProps) => {
  const { value, onChange, schema, uiSchema } = props;
  const customClassName = uiSchema?.['ui:options']?.className as string;

  // Convert string array to CategoryItem format expected by CategoryList
  const categoryItems = (value || []).map((label: string, index: number) => ({
    id: `category_${index}`,
    label,
  }));

  const handleUpdateList = (categories: { id: string; label: string }[]) => {
    // Convert back to string array for RJSF
    const stringArray = categories
      .map((cat) => cat.label)
      .filter((label) => label.trim() !== ''); // Filter out empty labels
    onChange(stringArray);
  };

  return (
    <div className={cn('flex flex-col gap-2', customClassName)}>
      <label className="text-sm font-medium text-neutral-charcoal">
        {schema.title}
      </label>
      {schema.description && (
        <p className="text-sm text-neutral-charcoal">{schema.description}</p>
      )}
      <CategoryList
        initialCategories={categoryItems}
        placeholder="Enter category name..."
        onUpdateList={handleUpdateList}
        className="rounded-lg"
      />
    </div>
  );
};

export const RichTextEditorWidget = (props: WidgetProps) => {
  const { value, required, onChange, schema, uiSchema, rawErrors } = props;

  const handleChange = (content: string) => {
    onChange(content);
  };

  // Allow custom className through uiSchema options
  const customClassName = uiSchema?.['ui:options']?.className as string;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-neutral-charcoal">
        {schema.title}
        {required && <span className="ml-1 text-functional-red">*</span>}
      </label>
      <div className="flex flex-col rounded-md border">
        <RichTextEditor
          content={value || ''}
          placeholder={uiSchema?.['ui:placeholder'] || 'Start writing...'}
          onChange={handleChange}
          onUpdate={handleChange}
          className="flex flex-1 flex-col"
          editorClassName={cn(
            'prose prose-sm min-h-52 max-w-none flex-1 p-4 focus:outline-none',
            customClassName,
          )}
          showToolbar={true}
          toolbarPosition="bottom"
        />
      </div>
      {schema.description && <Description>{schema.description}</Description>}
      {rawErrors && rawErrors.length > 0 && (
        <div className="text-sm text-functional-red">
          {rawErrors.join(', ')}
        </div>
      )}
    </div>
  );
};

export const ReviewSummaryWidget = (props: WidgetProps) => {
  // Access the full form data from the root level
  const formData = (props as any).formContext?.formData || props.formData || {};

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    try {
      // Use the UI package utility for consistent timezone-safe date parsing
      return formatDateCore(dateString, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateRange = (
    startDate: string | undefined,
    endDate: string | undefined,
  ) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    if (start === 'Not set' || end === 'Not set') return 'Not set';
    return `${start} - ${end}`;
  };

  // Types for dynamic summary configuration
  interface SummaryField {
    key: string;
    label: string;
    formatter: (value: any) => string;
    shouldShow?: (value: any) => boolean;
  }

  interface SummarySection {
    title: string;
    fields: SummaryField[];
  }

  // Dynamic summary configuration
  const summaryConfig: SummarySection[] = [
    {
      title: 'Process Details',
      fields: [
        {
          key: 'processName',
          label: 'Name',
          formatter: (value: any) => value || 'Not set',
        },
        {
          key: 'description',
          label: 'Description',
          formatter: (value: any) => value || 'Not set',
        },
        {
          key: 'totalBudget',
          label: 'Total Budget',
          formatter: formatCurrency,
        },
      ],
    },
    {
      title: 'Timeline',
      fields: [
        {
          key: 'ideaCollectionPhase',
          label: 'Idea Collection',
          formatter: (phase: any) =>
            formatDateRange(phase?.ideaCollectionOpen, phase?.ideaCollectionClose),
          // Only show if the phase has data
          shouldShow: (value: any) => Boolean(value?.ideaCollectionOpen || value?.ideaCollectionClose),
        },
        {
          key: 'proposalSubmissionPhase',
          label: 'Submissions',
          formatter: (phase: any) =>
            formatDateRange(phase?.submissionsOpen, phase?.submissionsClose),
          shouldShow: (value: any) => Boolean(value?.submissionsOpen || value?.submissionsClose),
        },
        {
          key: 'reviewShortlistingPhase',
          label: 'Review',
          formatter: (phase: any) =>
            formatDateRange(phase?.reviewOpen, phase?.reviewClose),
          shouldShow: (value: any) => Boolean(value?.reviewOpen || value?.reviewClose),
        },
        {
          key: 'votingPhase',
          label: 'Voting',
          formatter: (phase: any) =>
            formatDateRange(phase?.votingOpen, phase?.votingClose),
          shouldShow: (value: any) => Boolean(value?.votingOpen || value?.votingClose),
        },
        {
          key: 'resultsAnnouncement',
          label: 'Results',
          formatter: (phase: any) => formatDate(phase?.resultsDate),
          shouldShow: (value: any) => Boolean(value?.resultsDate),
        },
      ],
    },
    {
      title: 'Configuration',
      fields: [
        {
          key: 'maxVotesPerMember',
          label: 'Max votes per member',
          formatter: (value: any) =>
            value ? `${value} per member` : 'Not set',
        },
        {
          key: 'categories',
          label: 'Categories',
          formatter: (categories: string[]) => {
            if (!categories || categories.length === 0) return 'None';
            return `${categories.length} (${categories.join(', ')})`;
          },
        },
      ],
    },
  ];

  const SummarySection = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-neutral-charcoal">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );

  const SummaryRow = ({
    label,
    value,
  }: {
    label: string;
    value: string | React.ReactNode;
  }) => (
    <div className="flex items-start justify-between">
      <span className="text-sm font-medium text-neutral-charcoal">{label}</span>
      <span className="ml-4 flex-1 text-right text-sm text-neutral-charcoal">
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {summaryConfig.map((section) => {
        // Filter fields that should be shown
        const visibleFields = section.fields.filter((field) => {
          const value = formData[field.key];
          return field.shouldShow ? field.shouldShow(value) : true;
        });

        // Only render section if it has visible fields
        if (visibleFields.length === 0) return null;

        return (
          <SummarySection key={section.title} title={section.title}>
            {visibleFields.map((field) => {
              const value = formData[field.key];
              const formattedValue = field.formatter(value);
              
              return (
                <SummaryRow
                  key={field.key}
                  label={field.label}
                  value={formattedValue}
                />
              );
            })}
          </SummarySection>
        );
      })}
    </div>
  );
};

// Wrap widgets with error boundaries
const SafeTextWidget = withWidgetErrorBoundary(TextWidget, 'Text');
const SafeTextareaWidget = withWidgetErrorBoundary(TextareaWidget, 'Textarea');
const SafeNumberWidget = withWidgetErrorBoundary(NumberWidget, 'Number');
const SafeDateWidget = withWidgetErrorBoundary(DateWidget, 'Date');
const SafeCheckboxWidget = withWidgetErrorBoundary(CheckboxWidget, 'Checkbox');
const SafeRadioWidget = withWidgetErrorBoundary(RadioWidget, 'Radio');
const SafeCategoryListWidget = withWidgetErrorBoundary(
  CategoryListWidget,
  'CategoryList',
);
const SafeRichTextEditorWidget = withWidgetErrorBoundary(
  RichTextEditorWidget,
  'RichTextEditor',
);
const SafeReviewSummaryWidget = withWidgetErrorBoundary(
  ReviewSummaryWidget,
  'ReviewSummary',
);

export const CustomWidgets = {
  TextWidget: SafeTextWidget,
  TextareaWidget: SafeTextareaWidget,
  NumberWidget: SafeNumberWidget,
  DateWidget: SafeDateWidget,
  CheckboxWidget: SafeCheckboxWidget,
  RadioWidget: SafeRadioWidget,
  CategoryListWidget: SafeCategoryListWidget,

  RichTextEditorWidget: SafeRichTextEditorWidget,
  ReviewSummaryWidget: SafeReviewSummaryWidget,
  text: SafeTextWidget,
  textarea: SafeTextareaWidget,
  number: SafeNumberWidget,
  date: SafeDateWidget,
  checkbox: SafeCheckboxWidget,
  radio: SafeRadioWidget,
  CategoryList: SafeCategoryListWidget,
  RichTextEditor: SafeRichTextEditorWidget,
  ReviewSummary: SafeReviewSummaryWidget,
};
