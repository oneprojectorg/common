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
 * English serves as the canonical source of truth — other language dictionaries
 * must contain the same keys.
 */
export type TranslationKey = keyof typeof messages;

/**
 * Typed translation function returned by `useTranslations()`.
 *
 * Only accepts `TranslationKey` — typos and missing keys are caught at compile
 * time (no runtime enforcement). For dynamic keys (e.g. template field labels
 * from the database), cast with `as TranslationKey` to bypass the check.
 *
 * Values are typed as optional `Record<string, unknown>` because this custom
 * interface flattens all keys into a single `TranslationKey` union, which
 * discards the per-key value inference that next-intl normally provides.
 */
export interface TranslateFn {
  (key: TranslationKey, values?: Record<string, unknown>): string;
  rich(key: TranslationKey, values?: Record<string, unknown>): ReactNode;
  markup(key: TranslationKey, values?: Record<string, unknown>): string;
  raw(key: TranslationKey): unknown;
  has(key: TranslationKey): boolean;
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

// Periods are parsed as path separators by next-intl, so we need to replace
// them with underscores both here and in request.ts's getConfig helper.
const useTranslations = (): TranslateFn => {
  const translateFn = _useTranslations();

  return useMemo(() => {
    function transformKey(key: string): string {
      return key.replaceAll('.', '_');
    }

    const proxyTranslateFn = new Proxy(translateFn, {
      apply(target, thisArg, argumentsList: [string, ...unknown[]]) {
        const [message, ...rest] = argumentsList;
        const transformedMessage = transformKey(message);

        const result = Reflect.apply(target, thisArg, [
          transformedMessage,
          ...rest,
        ]);

        // If next-intl returns the transformed key itself, the key wasn't found.
        // Fall back to the original key so users see clean text with periods.
        if (result === transformedMessage) {
          return message;
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

    // Wrap rich(), markup(), raw(), and has() to apply dot-to-underscore transformation.
    // For string-returning methods, also apply the missing-key fallback.
    for (const method of ['rich', 'markup', 'raw', 'has'] as const) {
      const original = (translateFn as unknown as Record<string, unknown>)[
        method
      ] as Function;
      if (typeof original === 'function') {
        (proxyTranslateFn as unknown as Record<string, unknown>)[method] = (
          message: string,
          ...rest: unknown[]
        ) => {
          const transformedMessage = transformKey(message);
          const result = original.call(
            translateFn,
            transformedMessage,
            ...rest,
          );

          // Apply missing-key fallback for string results (markup returns string)
          if (typeof result === 'string' && result === transformedMessage) {
            return message;
          }

          return result;
        };
      }
    }

    return proxyTranslateFn as unknown as TranslateFn;
  }, [translateFn]);
};

export { Link, redirect, usePathname, useRouter, useTranslations };
