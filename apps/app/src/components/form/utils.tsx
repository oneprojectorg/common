import { createFormHook, createFormHookContexts } from '@tanstack/react-form';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';

const { fieldContext, formContext } = createFormHookContexts();
export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
  },
  formComponents: {
    Button,
    SubmitButton: (props) => <Button {...props} type="submit" />,
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
