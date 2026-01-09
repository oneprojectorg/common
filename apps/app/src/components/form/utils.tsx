import { Button } from '@op/ui/Button';
import type { ButtonProps } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import { Select } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
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
    ToggleButton,
    Checkbox,
  },
  formComponents: {
    Button: ({ className, ...props }: ButtonProps) => (
      <Button {...props} className={cn('sm:w-48 w-full', className)} />
    ),
    SubmitButton: ({ className, ...props }: ButtonProps) => (
      <Button
        {...props}
        className={cn('sm:w-48 w-full', className)}
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

export const getFieldErrorMessage = (
  field: AnyFieldApi,
): string | undefined => {
  return field.state.meta.isTouched
    ? field.state.meta.errors?.map((err) => err?.message ?? '').join(', ')
    : undefined;
};

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => any : never
) extends (x: infer I) => any
  ? I
  : never;
