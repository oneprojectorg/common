// Compat wrapper for @op/ui's Breadcrumbs. Pure API translation onto vanilla
// shadcn Breadcrumb primitives. Each <Breadcrumb> renders an item + separator
// (separator suppressed on the last child via :last-child trick).

'use client';

import type { ReactNode } from 'react';
import * as React from 'react';

import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';

export interface BreadcrumbsProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export const Breadcrumbs = ({
  children,
  className,
  'aria-label': ariaLabel,
}: BreadcrumbsProps) => {
  const childArray = React.Children.toArray(children);
  return (
    <ShadcnBreadcrumb aria-label={ariaLabel}>
      <BreadcrumbList className={className}>
        {childArray.map((child, i) => (
          <React.Fragment key={i}>
            {child}
            {i < childArray.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </ShadcnBreadcrumb>
  );
};

export interface BreadcrumbProps {
  children: ReactNode;
  href?: string;
  className?: string;
}

export const Breadcrumb = ({ children, href, className }: BreadcrumbProps) => {
  return (
    <BreadcrumbItem className={className}>
      {href ? (
        <BreadcrumbLink render={<a href={href} />}>{children}</BreadcrumbLink>
      ) : (
        <BreadcrumbPage>{children}</BreadcrumbPage>
      )}
    </BreadcrumbItem>
  );
};
