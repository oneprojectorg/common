import { z } from 'zod';

import { Step, Step2 } from './Step';

import type { Form, Return, Schema } from '@formity/react';

export type Values = [
  Form<{ fullName: string; title: string }>,
  Form<{ dog: string; cat: string }>,
  Return<{
    fullName: string;
    title: string;
    dog: string;
    cat: string;
  }>,
];

export const schema: Schema<Values> = [
  {
    form: {
      values: () => ({
        fullName: ['', []],
        title: ['', []],
      }),
      render: ({ values, onNext }) => (
        <Step
          key="main"
          defaultValues={values}
          resolver={z.object({
            fullName: z
              .string()
              .min(1, { message: 'Required' })
              .max(20, { message: 'Must be at most 20 characters' }),
            title: z
              .string()
              .min(1, { message: 'Required' })
              .max(20, { message: 'Must be at most 20 characters' }),
          })}
          onSubmit={onNext}
        />
      ),
    },
  },
  {
    form: {
      values: () => ({
        dog: ['', []],
        cat: ['', []],
      }),
      render: ({ values, onNext }) => (
        <Step2
          key="main"
          defaultValues={values}
          resolver={z.object({
            dog: z
              .string()
              .min(1, { message: 'Required' })
              .max(20, { message: 'Must be at most 20 characters' }),
            cat: z
              .string()
              .min(1, { message: 'Required' })
              .max(20, { message: 'Must be at most 20 characters' }),
          })}
          onSubmit={onNext}
        />
      ),
    },
  },
  {
    return: ({ fullName, title, dog, cat }) => ({
      fullName,
      title,
      dog,
      cat,
    }),
  },
];
