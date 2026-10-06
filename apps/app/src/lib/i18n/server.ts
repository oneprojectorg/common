import type { Messages, NamespaceKeys, NestedKeyOf } from 'use-intl';
import { createTranslator } from 'use-intl/core';

import { getMessageFallback, onTranslatorError } from './errorHandling';
import { loadMessages } from './messages';

/**
 * Translations outside React — a route's `head`, a loader, a server route.
 * Typed from the English dictionary exactly like `useTranslations`. Runs on
 * the server and in the browser alike, so it takes the locale explicitly
 * (usually `params.locale`).
 */
export const getTranslations = async <
  Namespace extends NamespaceKeys<Messages, NestedKeyOf<Messages>> = never,
>({
  locale,
  namespace,
}: {
  locale: string;
  namespace?: Namespace;
}) =>
  createTranslator<Messages, Namespace>({
    locale,
    messages: await loadMessages(locale),
    namespace,
    timeZone: 'UTC',
    onError: onTranslatorError,
    getMessageFallback,
  });
