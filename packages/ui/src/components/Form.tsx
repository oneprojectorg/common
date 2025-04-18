'use client';

import { Form as RACForm } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

import type { FormProps } from 'react-aria-components';

export const Form = (props: FormProps) => {
  return (
    <RACForm {...props} className={twMerge('flex gap-4', props.className)} />
  );
};
