'use client';

import { ChevronRight } from 'lucide-react';
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
} from 'react-aria-components';
import type {
  BreadcrumbProps,
  BreadcrumbsProps,
  LinkProps,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

import { composeTailwindRenderProps } from '../utils';
import { Link } from './Link';

export const Breadcrumbs = <T extends object>(props: BreadcrumbsProps<T>) => {
  return (
    <AriaBreadcrumbs
      {...props}
      className={twMerge('flex gap-1', props.className)}
    />
  );
};

export const Breadcrumb = (
  props: BreadcrumbProps & Omit<LinkProps, 'className'>,
) => {
  return (
    <AriaBreadcrumb
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex items-center gap-1',
      )}
    >
      <Link variant="secondary" {...props} />
      {props.href && <ChevronRight className="size-3 text-neutral-600" />}
    </AriaBreadcrumb>
  );
};
