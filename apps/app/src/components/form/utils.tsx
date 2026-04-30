import { Button } from '@op/ui/Button';
import type { ButtonProps } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import { Select } from '@op/ui/Select';
import { Switch } from '@op/ui/Switch';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import {
  AnyFieldApi,
  createFormHook,
  createFormHookContexts,
} from '@tanstack/react-form';

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    Select,
    MultiSelectComboBox,
    Switch,
    Checkbox,
  },
  formComponents: {
    Button: ({ className, ...props }: ButtonProps) => (
      <Button {...props} className={cn('w-full sm:w-48', className)} />
    ),
    SubmitButton: ({ className, ...props }: ButtonProps) => (
      <Button
        {...props}
        className={cn('w-full sm:w-48', className)}
        type="submit"
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
  const { isTouched, isBlurred, errors, errorMap } = field.state.meta;

  if (requireBlur) {
    if (!isBlurred) {
      return undefined;
    }
    // After blur, use errorMap.onChange as the source of truth when available.
    // It reflects the current value's validity in real-time and avoids
    // showing stale onBlur errors after the user types a valid value.
    // The value is an array of Zod issue objects from form-level validation.
    if ('onChange' in errorMap) {
      const raw = errorMap.onChange;
      if (!raw) {
        return undefined;
      }
      return formatErrors(Array.isArray(raw) ? raw : [raw]);
    }
    // onChange hasn't run yet (e.g., user tabbed through without typing) —
    // fall through to flat errors below.
  } else if (!isTouched) {
    return undefined;
  }

  return formatErrors(errors);
};

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => any : never
) extends (x: infer I) => any
  ? I
  : never;
