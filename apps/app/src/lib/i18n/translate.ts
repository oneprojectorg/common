import type {
  MessageKeys,
  Messages,
  NamespaceKeys,
  NestedKeyOf,
  useTranslations,
} from 'next-intl';

/**
 * The translator `useTranslations()` and `getTranslations()` return, named so
 * a helper that takes one as a parameter has something to declare. It is
 * next-intl's own type, so each key carries the values its message needs.
 * Pass the namespace to scope it, exactly as at the call site. The explicit
 * `never` default matters: without it TypeScript fills the namespace with its
 * constraint, the union of every namespace, and the keys go relative.
 */
export type TranslateFn<
  Namespace extends NamespaceKeys<Messages, NestedKeyOf<Messages>> = never,
> = ReturnType<typeof useTranslations<Namespace>>;

/**
 * Dot-joined path of every message in the English dictionary, which
 * `apps/app/global.d.ts` registers as next-intl's `Messages`. A call site
 * names its key inline and gets it typed by next-intl; this union is for the
 * places that carry a key as data — a navigation config, a criterion
 * registry, a validation result — and for the `as TranslationKey` escape a
 * label read from the database needs.
 */
export type TranslationKey = MessageKeys<Messages, NestedKeyOf<Messages>>;
