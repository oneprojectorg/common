// eslint-disable-next-line no-restricted-imports
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
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    // @ts-ignore
    <NavLink {...props} prefetch={true}>
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
        return target.apply(thisArg, [
          message.replaceAll('.', '_') as typeof message,
          ...rest,
        ]);
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
