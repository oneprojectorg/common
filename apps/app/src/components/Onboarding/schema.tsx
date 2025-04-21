import { z } from 'zod';

import { OrganizationDetailsForm, PersonalDetailsForm } from './Steps';

import type { Form, Return, Schema } from '@formity/react';

const resolvers = {
  PersonalDetailsForm: z.object({
    fullName: z
      .string()
      .min(1, { message: 'Required' })
      .max(20, { message: 'Must be at most 20 characters' }),
    title: z
      .string()
      .min(1, { message: 'Required' })
      .max(20, { message: 'Must be at most 20 characters' }),
  }),
  OrganizationDetailsForm: z.object({
    organizationName: z
      .string()
      .min(1, { message: 'Required' })
      .max(20, { message: 'Must be at most 20 characters' }),
    website: z
      .string()
      .url({ message: 'Invalid website address' })
      .min(1, { message: 'Required' })
      .max(20, { message: 'Must be at most 20 characters' }),
    email: z
      .string()
      .email({ message: 'Invalid email' })
      .max(20, { message: 'Must be at most 20 characters' }),
  }),
} as const;

type UnionToIntersection<U> = (U extends any ? (x: U) => any : never) extends (
  x: infer I,
) => any
  ? I
  : never;

type FormType = z.infer<
  UnionToIntersection<(typeof resolvers)[keyof typeof resolvers]>
>;

export type Values = [
  Form<z.infer<typeof resolvers.PersonalDetailsForm>>,
  Form<z.infer<typeof resolvers.OrganizationDetailsForm>>,
  Return<FormType>,
];

export const schema: Schema<Values> = [
  {
    form: {
      values: () => ({
        fullName: ['', []],
        title: ['', []],
      }),
      render: ({ values, onNext }) => (
        <PersonalDetailsForm
          key="main"
          defaultValues={values}
          resolver={resolvers.PersonalDetailsForm}
          onSubmit={onNext}
        />
      ),
    },
  },
  {
    form: {
      values: () => ({
        organizationName: ['', []],
        website: ['', []],
        email: ['', []],
      }),
      render: ({ values, onNext }) => (
        <OrganizationDetailsForm
          key="main"
          defaultValues={values}
          resolver={resolvers.OrganizationDetailsForm}
          onSubmit={onNext}
        />
      ),
    },
  },
  {
    return: (props) => props,
  },
];
