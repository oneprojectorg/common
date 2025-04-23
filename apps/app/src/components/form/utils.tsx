import { createFormHook, createFormHookContexts } from '@tanstack/react-form';

import { Button } from '@op/ui/Button';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import { Select } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { cn } from '@op/ui/utils';

import type { ButtonProps } from '@op/ui/Button';

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    Select,
    MultiSelectComboBox,
    ToggleButton,
  },
  formComponents: {
    Button: ({ className, ...props }: ButtonProps) => (
      <Button {...props} className={cn('min-w-48', className)} />
    ),
    SubmitButton: ({ className, ...props }: ButtonProps) => (
      <Button {...props} className={cn('min-w-48', className)} type="submit" />
    ),
  },
  fieldContext,
  formContext,
});

export interface StepProps {
  defaultValues: object;
  resolver?: any;
}

export const getFieldErrorMessage = (field: {
  state: { meta: { errors: { message: string }[] } };
}): string => {
  return field.state.meta.errors.map(err => err.message).join(', ');
};

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => any : never
) extends (x: infer I) => any
  ? I
  : never;
