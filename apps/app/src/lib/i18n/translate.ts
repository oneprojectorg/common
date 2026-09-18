import type { useTranslations } from 'next-intl';

import type messages from './dictionaries/en.json';

type Dictionary = typeof messages;

/** A dictionary: shared labels plus at most two levels of namespace. */
export type MessageTree = { [key: string]: string | MessageTree };

/**
 * Dot-joined path of every string in `Tree`. A dictionary holds shared labels
 * at the top level and namespace objects keyed by ID (ADR 0005), so the leaves
 * are what a call site may ask for.
 */
export type LeafPaths<Tree> = {
  [Key in keyof Tree & string]: Tree[Key] extends string
    ? Key
    : `${Key}.${LeafPaths<Tree[Key]>}`;
}[keyof Tree & string];

/** Dot-joined path of every object in `Tree` — the namespaces a caller may scope to. */
export type NamespacePaths<Tree> = {
  [Key in keyof Tree & string]: Tree[Key] extends string
    ? never
    : Key | `${Key}.${NamespacePaths<Tree[Key]>}`;
}[keyof Tree & string];

/** The part of `Tree` a namespace path addresses. */
export type Subtree<
  Tree,
  Path extends string,
> = Path extends `${infer Head}.${infer Rest}`
  ? Head extends keyof Tree
    ? Subtree<Tree[Head], Rest>
    : never
  : Path extends keyof Tree
    ? Tree[Path]
    : never;

/**
 * Union of all known translation keys derived from the English dictionary.
 * English serves as the canonical source of truth — other language dictionaries
 * must contain the same keys.
 *
 * A call site names its key inline and gets it typed by next-intl. This union
 * is for the few places that carry a key as data — a navigation config, a
 * criterion registry, a validation result — and for the `as TranslationKey`
 * escape a label read from the database needs.
 */
export type TranslationKey = LeafPaths<Dictionary>;

/** Union of the namespaces `useTranslations` and `getTranslations` accept. */
export type MessageNamespace = NamespacePaths<Dictionary>;

/** The keys a translator scoped to `Namespace` accepts, relative to it. */
export type KeysIn<Namespace extends MessageNamespace | undefined> =
  Namespace extends MessageNamespace
    ? LeafPaths<Subtree<Dictionary, Namespace>>
    : TranslationKey;

/**
 * The translator `useTranslations()` and `getTranslations()` return, named so
 * a helper that takes one as a parameter has something to declare. It is
 * next-intl's own type, so each key carries the values its message needs;
 * pass the namespace to scope it, exactly as at the call site.
 */
export type TranslateFn<Namespace extends MessageNamespace = never> =
  ReturnType<typeof useTranslations<Namespace>>;
