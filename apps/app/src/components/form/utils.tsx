import { createFormHook, createFormHookContexts } from '@tanstack/react-form';

import { Button, ButtonProps } from '@op/ui/Button';
import { Select } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    Select,
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

export const getFieldErrorMessage = (field) => {
  return field.state.meta.errors
    .map((err: { message: string }) => err?.message)
    .join(', ');
};

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => any : never
) extends (x: infer I) => any
  ? I
  : never;
