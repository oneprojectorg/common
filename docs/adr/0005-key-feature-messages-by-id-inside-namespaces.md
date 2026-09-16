# 0005. Key feature messages by ID inside namespaces

Date: 2026-09-16

## Status

Proposed

## Context

Messages are keyed by their English text, one flat file per locale, and every
new string is appended at the bottom of all eight files:

```text
apps/app/src/lib/i18n/dictionaries/en.json        1,760 keys, 8 locales
{
  "Invite more people": "Invite more people",
  ...
  "Text me a code": "Text me a code",
  "We'll email you a code to confirm it's yours.": "We'll email you a code to confirm it's yours."
}                                                  ← every PR appends here
```

This costs us three things. Two PRs that append at the same time conflict on
rebase: 122 of the 218 conflict resolutions `git rerere` recorded on one
machine are dictionary files. A copy change renames the key in eight files
and at every call site. A period in a key is next-intl's path separator, so
`messageKeys.ts` rewrites every key and `translate.ts` wraps every hook, which
drops next-intl's per-key value types. The rule already has 29 exceptions
(`COWOPHEADER`, `Duplicate_noun`, `{roleName} plural`, every ICU plural).

In scope: dictionary layout, key format, call-site API in `apps/app`. Out of
scope: how translations are produced; user content translated at runtime;
key order inside a file.

## Decision

We will keep shared copy at the top level and move feature copy under a
namespace, keyed by ID, in one nested file per locale.

```diff
 apps/app/src/lib/i18n/dictionaries/en.json
 {
   "Cancel": "Cancel",
-  "Comments off": "Comments off",
-  "Duplicate_noun": "Duplicate",
-  "Something went wrong on our end. Please try again": "Something went wrong on our end. Please try again",
+  "duplicateNoun": "Duplicate",
+  "somethingWentWrong": "Something went wrong on our end. Please try again",
+  "decisions": {
+    "comments": { "off": "Comments off" }
+  }
 }
```

```diff
-const t = useTranslations();
-t('Comments off');
-t("We'll email you a code to confirm it's yours.");
+const t = useTranslations('decisions.comments');
+t('off');
+t('emailCodeHint');
```

- **Top level** holds generic UI vocabulary that belongs to no feature:
  `Cancel`, `Back`, `Save`, `No results`, `Try again`. A plain label keeps
  its English text as key; a generic sentence, or any message with ICU
  syntax, gets a camelCase ID. A string owned by a feature lives in that
  feature's namespace even when another feature reads it.
- A **namespace** is a top-level object per feature area (`decisions`,
  `profile`, `onboarding`). Its keys are camelCase IDs that name the string's
  role, not its wording, at most one level deep.
- **No key contains `.`**, at any level.
- The English value is the copy. A copy change edits the value only.

```diff
 apps/app/src/lib/i18n/
 ├── dictionaries/<locale>.json   # shared labels + feature namespaces
 ├── dictionaries.test.ts         # + same keys in every locale, no duplicates
-├── messageKeys.ts               # "." → "_" on both sides of the lookup
-├── translate.ts                 # wrapper that re-applies it
-├── server.ts                    # wrapped getTranslations
 └── request.ts
```

Migration, one feature at a time, behaviour-neutral for users:

```text
now      new strings go into a namespace; shared labels stay at the top level
per PR   a feature's keys → namespace IDs, its call sites → useTranslations('ns')
         codemod where the key is a literal
end      no key contains "." → delete messageKeys.ts, translate.ts, server.ts
```

Sorting the dictionaries by key, which would stop the remaining tail
conflicts inside a namespace, is a follow-up. `oxfmt` cannot sort JSON keys
yet (oxc-project/oxc#21644).

## Consequences

- About 50 generic labels stay at the top level; the other ~1,700 keys move
  under a namespace. Using a string from several files does not make it
  generic: `Untitled Proposal` is read from 20 files and is still
  `decisions` copy.
- Features write to different namespaces, so concurrent PRs collide only
  when they touch the same feature.
- A wording change is one value per locale, not a rename in eight files and
  every call site.
- Call sites use next-intl's own hooks and get per-key value typing back.
- A namespaced call site no longer shows the English text; a reader opens
  `en.json` or hovers the key.
- Every new feature string needs a name and a namespace, and reviewers check
  both.
- About 2,280 literal call sites move over time; the 5 `as TranslationKey`
  escapes map to typed namespaces or `t.has`.
- `apps/app/scripts/check-missing-intl-keys.ts` is replaced by the
  dictionaries test. The `i18n-strings` skill and `CLAUDE.md` change on
  acceptance.

## References

- next-intl, [Translations](https://next-intl.dev/docs/usage/translations):
  "it's generally recommended to use IDs as keys"; "Namespace keys cannot
  contain the character '.'".
- [oxc-project/oxc#21644](https://github.com/oxc-project/oxc/issues/21644):
  open request for JSON key sorting in `oxfmt`.
