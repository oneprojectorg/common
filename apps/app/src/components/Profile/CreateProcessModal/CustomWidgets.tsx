import { CategoryList } from '@op/ui/CategoryList';
import { Checkbox } from '@op/ui/Checkbox';
import { DatePicker } from '@op/ui/DatePicker';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { TextField } from '@op/ui/TextField';
import { WidgetProps } from '@rjsf/utils';

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

  // Helper function to create a DateValue-like object from ISO string
  const parseISOString = (isoString: string) => {
    if (!isoString) return undefined;
    
    try {
      const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(isoString.trim());
      if (match) {
        const [, yearStr, monthStr, dayStr] = match;
        if (yearStr && monthStr && dayStr) {
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10);
          const day = parseInt(dayStr, 10);
        
        // Validate the date is real
        const testDate = new Date(year, month - 1, day);
        if (
          testDate.getFullYear() === year &&
          testDate.getMonth() === month - 1 &&
          testDate.getDate() === day
        ) {
          return { year, month, day };
        }
        }
      }
    } catch (error) {
      console.warn('Failed to parse date value:', isoString, error);
    }
    
    return undefined;
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

export const CustomWidgets = {
  TextWidget,
  TextareaWidget,
  NumberWidget,
  DateWidget,
  CheckboxWidget,
  RadioWidget,
  CategoryListWidget,
  text: TextWidget,
  textarea: TextareaWidget,
  number: NumberWidget,
  date: DateWidget,
  checkbox: CheckboxWidget,
  radio: RadioWidget,
  CategoryList: CategoryListWidget,
};
