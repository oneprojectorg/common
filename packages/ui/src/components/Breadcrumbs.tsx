'use client';

import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
} from 'react-aria-components';
import type {
  BreadcrumbProps,
  BreadcrumbsProps,
  LinkProps,
} from 'react-aria-components';
import { LuChevronRight } from 'react-icons/lu';
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
      <Link variant={props.href ? 'primary' : 'neutral'} {...props} />
      {props.href && <LuChevronRight className="size-3" />}
    </AriaBreadcrumb>
  );
};
