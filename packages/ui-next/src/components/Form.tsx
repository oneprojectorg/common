'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

export const Form = ({
  className,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement>) => {
  return (
    <form {...props} className={cn('flex flex-col gap-4', className)} />
  );
};
