import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import {
  AnyFieldApi,
  createFormHook,
  createFormHookContexts,
} from '@tanstack/react-form';
import { type ComponentProps, type ReactNode } from 'react';

const formatErrors = (errors: unknown[] | undefined): string | undefined => {
  const messages = errors
    ?.map((err) =>
      typeof err === 'string'
        ? err
        : (err as { message?: string } | null)?.message,
    )
    .filter(Boolean);
  if (!messages || messages.length === 0) {
    return undefined;
  }
  return [...new Set(messages)].join(', ');
};

export const getFieldErrorMessage = (
  field: AnyFieldApi,
  { requireBlur = false }: { requireBlur?: boolean } = {},
): string | undefined => {
  const { isTouched, isBlurred, errorMap } = field.state.meta;

  // Gate on interaction — unless a submit was attempted, in which case the
  // whole form has been "acted on" and every invalid field should surface
  // (otherwise hitting Submit on an untouched invalid form does nothing).
  const submitted =
    ((field.form?.state as { submissionAttempts?: number } | undefined)
      ?.submissionAttempts ?? 0) > 0;
  if (!submitted && (requireBlur ? !isBlurred : !isTouched)) {
    return undefined;
  }

  // Single source of truth: prefer the live onChange result (reflects the
  // current value in real time), then onSubmit, then onBlur. Never merge the
  // flat `errors` list — the same failure logged by multiple validator
  // lifecycles would double up ("Invalid email, Invalid email address").
  const raw =
    'onChange' in errorMap
      ? errorMap.onChange
      : (errorMap.onSubmit ?? errorMap.onBlur);
  if (!raw) {
    return undefined;
  }
  return formatErrors(Array.isArray(raw) ? raw : [raw]);
};

const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

// Field components are @op/sense, wired to the TanStack field via
// useFieldContext() — value/change/blur/error come from context, so call sites
// pass only presentation props (label, placeholder, options, isRequired). Use
// them inside `form.AppField`; the field name binds the component to its state.

// RAC-style size kept only as a prop alias, mapped to sense's own scale.
type FieldSize = 'small' | 'medium' | 'large';
const toSelectSize = (size?: FieldSize) =>
  size === 'small' ? 'sm' : 'default';
const toSwitchSize = (size?: FieldSize) =>
  size === 'small' ? 'sm' : 'default';

type TextFieldProps = Omit<
  ComponentProps<'input'>,
  'value' | 'onChange' | 'onBlur' | 'id' | 'name'
> & {
  label?: ReactNode;
  description?: ReactNode;
  isRequired?: boolean;
  /** Leading icon — renders the input inside an InputGroup. */
  icon?: ReactNode;
};

const TextField = ({
  label,
  description,
  isRequired,
  icon,
  className,
  ...inputProps
}: TextFieldProps) => {
  const field = useFieldContext<string>();
  const error = getFieldErrorMessage(field as AnyFieldApi, {
    requireBlur: true,
  });
  const invalid = error ? true : undefined;

  const control = icon ? (
    <InputGroup aria-invalid={invalid}>
      <InputGroupAddon align="inline-start">{icon}</InputGroupAddon>
      <InputGroupInput
        id={field.name}
        name={field.name}
        value={field.state.value ?? ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        aria-required={isRequired || undefined}
        aria-invalid={invalid}
        {...inputProps}
      />
    </InputGroup>
  ) : (
    <Input
      id={field.name}
      name={field.name}
      value={field.state.value ?? ''}
      onChange={(e) => field.handleChange(e.target.value)}
      onBlur={field.handleBlur}
      aria-required={isRequired || undefined}
      aria-invalid={invalid}
      {...inputProps}
    />
  );

  return (
    <Field className={className}>
      {label ? (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLabel>
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {control}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};

type TextAreaFieldProps = Omit<
  ComponentProps<'textarea'>,
  'value' | 'onChange' | 'onBlur' | 'id' | 'name'
> & {
  label?: ReactNode;
  description?: ReactNode;
  isRequired?: boolean;
};

const TextAreaField = ({
  label,
  description,
  isRequired,
  className,
  ...textareaProps
}: TextAreaFieldProps) => {
  const field = useFieldContext<string>();
  const error = getFieldErrorMessage(field as AnyFieldApi, {
    requireBlur: true,
  });

  return (
    <Field>
      {label ? (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLabel>
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value ?? ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        aria-required={isRequired || undefined}
        aria-invalid={error ? true : undefined}
        // className routes to the control so consumers can size the textarea
        // (e.g. min-h-*), not just the field wrapper.
        className={className}
        {...textareaProps}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};

export interface SelectOption {
  value: string;
  label: ReactNode;
}

interface SelectFieldProps {
  label?: ReactNode;
  description?: ReactNode;
  isRequired?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options: Array<SelectOption>;
  size?: FieldSize;
  className?: string;
}

const SelectField = ({
  label,
  description,
  isRequired,
  disabled,
  placeholder,
  options,
  size,
  className,
}: SelectFieldProps) => {
  const field = useFieldContext<string>();
  const error = getFieldErrorMessage(field as AnyFieldApi, {
    requireBlur: true,
  });
  // Value->label map so base-ui's SelectValue renders the label, not the id.
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <Field className={className}>
      {label ? (
        <FieldLabel>
          {label}
          {isRequired ? <RequiredAsterisk /> : null}
        </FieldLabel>
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <Select
        items={items}
        value={field.state.value ?? ''}
        onValueChange={(value) => field.handleChange(String(value))}
        disabled={disabled}
      >
        <SelectTrigger
          onBlur={field.handleBlur}
          size={toSelectSize(size)}
          aria-required={isRequired || undefined}
          aria-invalid={error ? true : undefined}
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};

type SwitchFieldProps = Omit<
  ComponentProps<typeof Switch>,
  'checked' | 'onCheckedChange' | 'size'
> & {
  size?: FieldSize;
};

const SwitchField = ({ size, ...props }: SwitchFieldProps) => {
  const field = useFieldContext<boolean>();
  return (
    <Switch
      checked={!!field.state.value}
      onCheckedChange={(checked) => field.handleChange(checked)}
      size={toSwitchSize(size)}
      {...props}
    />
  );
};

type CheckboxFieldProps = Omit<
  ComponentProps<typeof Checkbox>,
  'checked' | 'onCheckedChange'
>;

const CheckboxField = (props: CheckboxFieldProps) => {
  const field = useFieldContext<boolean>();
  return (
    <Checkbox
      checked={!!field.state.value}
      onCheckedChange={(checked) => field.handleChange(checked === true)}
      {...props}
    />
  );
};

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    TextArea: TextAreaField,
    Select: SelectField,
    Switch: SwitchField,
    Checkbox: CheckboxField,
  },
  formComponents: {
    Button: ({ className, ...props }: ComponentProps<typeof Button>) => (
      <Button {...props} className={cn('w-full sm:w-48', className)} />
    ),
    SubmitButton: ({ className, ...props }: ComponentProps<typeof Button>) => (
      <Button
        {...props}
        type="submit"
        className={cn('w-full sm:w-48', className)}
      />
    ),
  },
  fieldContext,
  formContext,
});

export interface StepProps {
  defaultValues: object;
  resolver?: any;
}

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => any : never
) extends (x: infer I) => any
  ? I
  : never;
