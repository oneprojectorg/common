# 0005. Key messages by ID, one sorted file per namespace

Date: 2026-09-16

## Status

Proposed

## Context

The app keys its next-intl messages by the English source string. Each
locale is one flat JSON file of about 1,760 entries, and a new string is
appended to the bottom of all eight files. Three problems follow.

**Rebase conflicts.** Two branches that each append to the same tail collide
on the same lines. In the three months to 2026-09-16, 93 of 478 commits on
`dev` touched `en.json`; 29 of them appended at the tail, and 61% of all added
dictionary lines landed there. Of the 218 conflict resolutions `git rerere`
recorded on one contributor's machine, 122 are dictionary files. Replaying
PR #2042 and PR #2010 from their common base reproduces the conflict; the same
two edits merge cleanly when the file is kept sorted by key. Appending, not the
key style, causes the conflicts.

**Copy edits are key renames.** A wording change rewrites the key at every
call site and in all eight dictionaries; 22 of the 93 commits both added and
removed keys. A period in a key collides with next-intl's path separator, so
`messageKeys.ts` rewrites every key on both sides of the lookup, `translate.ts`
wraps `useTranslations` and `getTranslations`, and the wrapper flattens the
per-key value types next-intl would otherwise infer. next-intl itself
recommends IDs as keys and forbids `.` in them.

**The rule already has exceptions.** 29 entries are IDs in all but name
(`COWOPHEADER`, `platformAdmin_allUsers`, `Duplicate_noun`, `{roleName} plural`,
every ICU plural). 296 keys are shared by more than one file (`Cancel` by 27),
so shared copy has no owner.

In scope: the dictionary layout, the key format, and the call-site API in
`apps/app`. Out of scope: how translations are produced, and user content
translated at runtime.

## Decision

We will key messages by ID, grouped into namespaces, one file per namespace
and locale, with every file sorted by key:

```
apps/app/src/lib/i18n/dictionaries/<locale>/<namespace>.json
```

- A **namespace** is a feature area (`decisions`, `profile`, `onboarding`, ...)
  plus `common` for copy that two or more features share. `request.ts` loads
  every file of the locale into one `messages` object keyed by namespace.
- A **key** is a camelCase ID that names the role of the string, not its
  wording (`reviewQueue.emptyTitle`, `submit`). Nesting goes at most one level
  below the namespace. No key contains `.`.
- The English value is the copy. A copy change edits the value only.
- Call sites take the narrowest namespace that covers their strings:
  `const t = useTranslations('decisions.reviewQueue')`. The variable stays `t`.
- Every dictionary file is sorted by key in code-point order. The dictionaries
  test fails on an unsorted file, a duplicate key, or a key set that differs
  between locales, as it does today for the flat files.
- `messageKeys.ts`, the `translate.ts` wrapper, and our `getTranslations`
  re-export go away once no key contains a period. Call sites use next-intl's
  own hooks and get its per-key value typing back.

We migrate in two steps, each behaviour-neutral for users:

1. Sort the eight flat files by key and enforce it in the test. One PR, no
   call-site change. This removes the conflicts on its own.
2. Move strings into namespaces one feature at a time, together with the
   feature's call sites, by codemod where the key is a literal. The flat file
   stays as the namespace-less remainder until it is empty; new strings go into
   a namespace from the day step 1 merges.

## Consequences

- Concurrent PRs stop colliding in dictionaries: inserts spread across a
  sorted file, and features write to different files.
- A wording change is a one-value edit per locale, not a rename in eight
  files and every call site.
- Homonyms and plurals get a name instead of a disguised ID.
- The call site no longer shows the English text. A reader opens the `en`
  file, or hovers the key in an editor with next-intl's type information.
- Every new string needs a name and a namespace, and reviewers check both.
- About 2,280 literal call sites and 16 dynamic-key sites move during step 2.
  The `as TranslationKey` escapes (5 sites) map to typed namespaces or
  `t.has`.
- `apps/app/scripts/check-missing-intl-keys.ts`, already stale, is replaced by
  the dictionaries test.
- The `i18n-strings` skill and `CLAUDE.md` change to the new layout when
  step 1 merges.

## References

- next-intl, [Translations](https://next-intl.dev/docs/usage/translations):
  "it's generally recommended to use IDs as keys"; "Namespace keys cannot
  contain the character '.'".
- PR #2042 and PR #2010: the reproduced tail conflict (2026-09-13).
