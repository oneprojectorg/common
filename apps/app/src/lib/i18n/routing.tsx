// eslint-disable-next-line no-restricted-imports
import { cn } from '@op/ui/utils';
import { useTranslations as _useTranslations } from 'next-intl';
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useMemo } from 'react';

import { i18nConfig } from './config';
import type messages from './dictionaries/en.json';

/**
 * Union of all known translation keys derived from the English dictionary.
 * Provides autocompletion and compile-time typo checking.
 */
export type MessageKey = keyof typeof messages;

/**
 * Typed translation function returned by `useTranslations()`.
 *
 * Only accepts `MessageKey` — typos and missing keys are caught at compile time.
 * For dynamic keys (e.g. template field labels from the database), cast with
 * `as MessageKey` to bypass the check explicitly.
 *
 * Values are always optional `Record<string, unknown>` because JSON imports
 * type all values as `string`, preventing next-intl from inferring ICU params.
 */
export interface TranslateFn {
  (key: MessageKey, values?: Record<string, unknown>): string;
  rich(key: MessageKey, values?: Record<string, unknown>): ReactNode;
  markup(key: MessageKey, values?: Record<string, unknown>): string;
  raw(key: MessageKey): unknown;
  has(key: MessageKey): boolean;
}

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
const useTranslations = (): TranslateFn => {
  const translateFn = _useTranslations();

  return useMemo(() => {
    const proxyTranslateFn = new Proxy(translateFn, {
      apply(target, thisArg, argumentsList: [string, ...unknown[]]) {
        const [message, ...rest] = argumentsList;
        const originalMessage = message;
        const transformedMessage = message.replaceAll('.', '_');

        const result = Reflect.apply(target, thisArg, [
          transformedMessage,
          ...rest,
        ]);

        // If the result is the same as the transformed message, it means the key wasn't found
        // In this case, return the original message with periods intact
        if (result === transformedMessage) {
          return originalMessage;
        }

        return result;
      },
    });

    Reflect.ownKeys(translateFn).forEach((key) => {
      const propertyDescriptor = Object.getOwnPropertyDescriptor(
        translateFn,
        key,
      );

      if (propertyDescriptor) {
        Object.defineProperty(proxyTranslateFn, key, propertyDescriptor);
      }
    });

    // Wrap rich() and markup() to also apply dot-to-underscore transformation
    for (const method of ['rich', 'markup'] as const) {
      const original = (translateFn as unknown as Record<string, unknown>)[
        method
      ] as Function;
      if (typeof original === 'function') {
        (proxyTranslateFn as unknown as Record<string, unknown>)[method] = (
          message: string,
          ...rest: unknown[]
        ) => {
          const transformedMessage = message.replaceAll('.', '_');
          return original.call(translateFn, transformedMessage, ...rest);
        };
      }
    }

    return proxyTranslateFn as unknown as TranslateFn;
  }, [translateFn]);
};

export { Link, redirect, usePathname, useRouter, useTranslations };
