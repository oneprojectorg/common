import { parseDate } from '@internationalized/date';
import { CategoryList } from '@op/ui/CategoryList';
import { Checkbox } from '@op/ui/Checkbox';
import { DatePicker } from '@op/ui/DatePicker';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { TextField } from '@op/ui/TextField';
import { WidgetProps } from '@rjsf/utils';
import React from 'react';

// Higher-order component to wrap widgets with error boundaries
const withWidgetErrorBoundary = <P extends WidgetProps>(
  WrappedWidget: React.ComponentType<P>,
  widgetName: string
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
            <p className="text-xs text-neutral-gray4 mt-1">
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
    />
  );
};

export const DateWidget = (props: WidgetProps) => {
  const { id, value, required, onChange, onBlur, onFocus, schema, rawErrors } =
    props;

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
    if (newDateValue && newDateValue.year && newDateValue.month && newDateValue.day) {
      // Convert the DateValue to ISO string format for the form
      const isoString = `${newDateValue.year}-${String(newDateValue.month).padStart(2, '0')}-${String(newDateValue.day).padStart(2, '0')}`;
      onChange(isoString);
    } else {
      onChange('');
    }
  };

  // Add date range validation for business logic
  const validateDateRanges = (selectedDate: string): string[] => {
    const errors: string[] = [];
    if (!selectedDate) return errors;
    
    try {
      const selected = new Date(selectedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if date is valid
      if (isNaN(selected.getTime())) {
        errors.push('Invalid date format');
        return errors;
      }
      
      // Business rule: dates should not be in the past
      if (selected < today) {
        errors.push('Date cannot be in the past');
      }
      
      // Business rule: dates should be within reasonable future range (2 years)
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      if (selected > twoYearsFromNow) {
        errors.push('Date cannot be more than 2 years in the future');
      }
    } catch (error) {
      errors.push('Invalid date format');
    }
    
    return errors;
  };

  // Combine RJSF validation errors with our custom validation
  const allErrors = [
    ...(rawErrors || []),
    ...validateDateRanges(value as string)
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
      />
    );
  } catch (error) {
    console.error('DateWidget render error:', error, 'value:', value, 'dateValue:', dateValue);
    return (
      <div className="rounded border border-functional-red/20 bg-functional-red/5 p-3">
        <p className="text-sm text-functional-red">
          Date widget error: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <p className="text-xs text-neutral-gray4 mt-1">
          Value: {JSON.stringify(value)} | Parsed: {JSON.stringify(dateValue)}
        </p>
      </div>
    );
  }
};

export const CheckboxWidget = (props: WidgetProps) => {
  const { id, value, onChange, schema } = props;

  return (
    <Checkbox
      id={id}
      isSelected={value || false}
      onChange={(val) => onChange(val)}
    >
      {schema.title}
    </Checkbox>
  );
};

export const RadioWidget = (props: WidgetProps) => {
  const { value, onChange, schema, options } = props;
  const { enumOptions } = options;

  return (
    <div className="flex flex-col gap-2">
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

  const handleChange = (numericValue: number | null) => {
    onChange(numericValue);
  };

  return (
    <NumberField
      id={id}
      label={schema.title || ''}
      value={value || null}
      isRequired={required}
      inputProps={{
        placeholder: uiSchema?.['ui:placeholder'] || placeholder,
        onBlur: () => onBlur(id, value),
        onFocus: () => onFocus(id, value),
      }}
      description={schema.description}
      onChange={handleChange}
      errorMessage={rawErrors?.join(', ')}
    />
  );
};

export const CategoryListWidget = (props: WidgetProps) => {
  const { value, onChange, schema } = props;

  // Convert string array to CategoryItem format expected by CategoryList
  const categoryItems = (value || []).map((label: string, index: number) => ({
    id: `category_${index}`,
    label,
  }));

  const handleUpdateList = (categories: { id: string; label: string }[]) => {
    // Convert back to string array for RJSF
    const stringArray = categories
      .map(cat => cat.label)
      .filter(label => label.trim() !== ''); // Filter out empty labels
    onChange(stringArray);
  };

  return (
    <div className="flex flex-col gap-2">
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

// Wrap widgets with error boundaries
const SafeTextWidget = withWidgetErrorBoundary(TextWidget, 'Text');
const SafeTextareaWidget = withWidgetErrorBoundary(TextareaWidget, 'Textarea');
const SafeNumberWidget = withWidgetErrorBoundary(NumberWidget, 'Number');
const SafeDateWidget = withWidgetErrorBoundary(DateWidget, 'Date');
const SafeCheckboxWidget = withWidgetErrorBoundary(CheckboxWidget, 'Checkbox');
const SafeRadioWidget = withWidgetErrorBoundary(RadioWidget, 'Radio');
const SafeCategoryListWidget = withWidgetErrorBoundary(CategoryListWidget, 'CategoryList');

export const CustomWidgets = {
  TextWidget: SafeTextWidget,
  TextareaWidget: SafeTextareaWidget,
  NumberWidget: SafeNumberWidget,
  DateWidget: SafeDateWidget,
  CheckboxWidget: SafeCheckboxWidget,
  RadioWidget: SafeRadioWidget,
  CategoryListWidget: SafeCategoryListWidget,
  text: SafeTextWidget,
  textarea: SafeTextareaWidget,
  number: SafeNumberWidget,
  date: SafeDateWidget,
  checkbox: SafeCheckboxWidget,
  radio: SafeRadioWidget,
  CategoryList: SafeCategoryListWidget,
};
