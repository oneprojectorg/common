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

  const handleDateChange = (dateValue: any) => {
    if (dateValue) {
      // Convert the DateValue to ISO string format for the form
      const isoString = `${dateValue.year}-${String(dateValue.month).padStart(2, '0')}-${String(dateValue.day).padStart(2, '0')}`;
      onChange(isoString);
    } else {
      onChange('');
    }
  };

  return (
    <DatePicker
      label={schema.title || ''}
      value={value}
      isRequired={required}
      placeholder="Select date"
      description={schema.description}
      onChange={handleDateChange}
      errorMessage={rawErrors?.join(', ')}
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
