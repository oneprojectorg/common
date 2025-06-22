// eslint-disable-next-line no-restricted-imports
import { cn } from '@op/ui/utils';
import { useTranslations as _useTranslations } from 'next-intl';
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import { AnchorHTMLAttributes, useMemo } from 'react';

import { i18nConfig } from './config';

export const routing = defineRouting(i18nConfig);

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
const {
  Link: NavLink,
  redirect,
  usePathname,
  useRouter,
} = createNavigation(routing);

const Link = ({
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    // @ts-ignore
    <NavLink
      {...props}
      className={cn('hover:underline', className)}
      prefetch={true}
    >
      {children}
    </NavLink>
  );
};

// periods are parsed as path separators by next-intl, so we need to replace
// them with underscores both here and in getRequestConfig
const useTranslations: typeof _useTranslations = (...args) => {
  const translateFn = _useTranslations(...args);

  return useMemo(() => {
    const proxyTranslateFn = new Proxy(translateFn, {
      apply(target, thisArg, argumentsList: Parameters<typeof translateFn>) {
        const [message, ...rest] = argumentsList;
        const originalMessage = message;
        const transformedMessage = message.replaceAll('.', '_') as typeof message;
        
        const result = target.apply(thisArg, [transformedMessage, ...rest]);
        
        // If the result is the same as the transformed message, it means the key wasn't found
        // In this case, return the original message with periods intact
        if (result === transformedMessage) {
          return originalMessage;
        }
        
        return result;
      },
    }) as typeof translateFn;

    Reflect.ownKeys(translateFn).forEach((key) => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(
        translateFn,
        key,
      );

      if (propertyDescriptor) {
        Object.defineProperty(proxyTranslateFn, key, propertyDescriptor);
      }
    });

    return proxyTranslateFn;
  }, [translateFn]);
};

export { Link, redirect, usePathname, useRouter, useTranslations };
