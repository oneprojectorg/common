# NNNN. Key feature messages by ID inside namespaces

Date: 2026-09-16

## Status

Accepted

## Context

Messages were keyed by their English text, in one flat file per locale, and
every new string was appended at the bottom of all eight files. This cost us
three things:

- Two PRs that appended at the same time conflicted on rebase. 122 of the 218
  conflict resolutions `git rerere` recorded on one machine were dictionary
  files.
- A copy change renamed the key in eight files and at every call site.
- next-intl reads a period in a key as a path separator, so a wrapper
  rewrote every key and dropped next-intl's per-key value types.

In scope: dictionary layout, key format, and the call-site API in `apps/app`.
Out of scope: how translations are produced, and user content translated at
runtime.

## Decision

We will keep shared labels at the top level and put feature copy in a
namespace, keyed by ID, in one nested file per locale.

```json
{
  "Cancel": "Cancel",
  "somethingWentWrong": "Something went wrong on our end. Please try again",
  "auth": {
    "emailOwnershipHint": "We'll email you a code to confirm it's yours."
  }
}
```

```ts
const t = useTranslations('auth');
t('emailOwnershipHint');
```

- **Top level** holds generic UI vocabulary that belongs to no feature. A
  label of at most four words, with no `{`, `<` or `.`, keeps its English
  text as its key (`Cancel`, `No results`). Any other shared message gets a
  camelCase ID.
- A **namespace** is a top-level object per feature (`auth`, `decisions`,
  `profile`). Its keys are camelCase IDs that name the string's role, not its
  wording. A large feature may split into sub-namespaces one level down
  (`decisions.processBuilder`).
- A string belongs to the feature that owns the concept, even when another
  feature reads it.
- **No key contains `.`**, at any level.
- The English value is the copy. A copy change edits the value only.
- Call sites use next-intl's own `useTranslations` and `getTranslations`, so
  each key keeps its value types.

## Consequences

- Features write to different namespaces, so concurrent PRs conflict only
  when they touch the same feature.
- A wording change edits one value per locale, not a key in eight files and
  every call site.
- An English-only edit no longer touches the other locales, so a stale
  translation is silent. `apps/app/scripts/check-dictionaries.ts`
  (`pnpm i18n:check`) fails when an English value changes and a translation
  does not.
- `apps/app/src/lib/i18n/dictionaries.test.ts` checks that every locale has
  the same keys, that each message formats, that no key is declared twice or
  contains `.`, and that top-level keys follow the rule above.
- A call site no longer shows the English text. A reader opens `en.json` or
  hovers the key.
- Every new feature string needs an ID and a namespace, and reviewers check
  both.
- Keys are not sorted, so two PRs can still conflict at the end of the same
  namespace. Sorting is a follow-up: `oxfmt` cannot sort JSON keys yet
  (oxc-project/oxc#21644).

## References

- next-intl, [Translations](https://next-intl.dev/docs/usage/translations):
  "it's generally recommended to use IDs as keys"; "Namespace keys cannot
  contain the character '.'".
