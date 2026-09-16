# 0005. Key messages by ID in one sorted dictionary per locale

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

Two PRs that append at the same time collide on rebase. PR #2042 and PR #2010,
both merged on 2026-09-13, replayed from their common base:

```text
  "Older version reviewed by {name}": "Older version reviewed by {name}",
<<<<<<< #2042
  "Participants can comment on proposals during this phase.": "...",
  "Comments off": "Comments off"
=======
  "Reject": "Reject",
  "Your Privacy": "Your Privacy",
  "We use essential cookies to make Common work, ...": "..."
>>>>>>> #2010
}
```

The same two edits merge cleanly when the file is sorted. Three months of
`dev` up to 2026-09-16:

| | |
| --- | --- |
| Commits that touched `en.json` | 93 of 478 |
| Of those, appended at the tail | 29 |
| Of those, renamed keys because copy changed | 22 |
| `git rerere` conflict resolutions that are dictionary files | 122 of 218 |

The sentence keys carry two more costs. A copy change renames the key in eight
files and at every call site. A period in a key is next-intl's path separator,
so `messageKeys.ts` rewrites every key and `translate.ts` wraps every hook,
which drops next-intl's per-key value types. The rule already has 29
exceptions (`COWOPHEADER`, `Duplicate_noun`, `{roleName} plural`, every ICU
plural), and 296 keys such as `Cancel` are shared across files with no owner.

In scope: dictionary layout, key format, call-site API in `apps/app`. Out of
scope: how translations are produced; user content translated at runtime.

## Decision

We will key messages by ID inside feature namespaces, in one nested file per
locale, sorted by key at every level.

```diff
 apps/app/src/lib/i18n/dictionaries/en.json
 {
-  "Cancel": "Cancel",
-  "Comments off": "Comments off",
-  "Duplicate_noun": "Duplicate",
-  "Invite more people": "Invite more people"
+  "common": {
+    "cancel": "Cancel",
+    "duplicateNoun": "Duplicate"
+  },
+  "decisions": {
+    "comments": { "off": "Comments off" }
+  },
+  "invites": {
+    "inviteMore": "Invite more people"
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

- A **namespace** is a top-level object per feature area, plus `common` for
  copy two or more features share.
- A **key** is a camelCase ID naming the string's role, not its wording. At
  most one level below the namespace. No `.` in a key.
- The English value is the copy. A copy change edits the value only.
- Every object is sorted in code-point order. `oxfmt` cannot sort JSON keys
  (oxc-project/oxc#21644), so `pnpm i18n:sort` rewrites the files and the
  dictionaries test fails on an unsorted object, a duplicate key, or a key
  set that differs between locales.

```diff
 apps/app/src/lib/i18n/
 ├── dictionaries/<locale>.json   # nested, sorted
 ├── dictionaries.test.ts         # + sorted, + same keys in every locale
-├── messageKeys.ts               # "." → "_" on both sides of the lookup
-├── translate.ts                 # wrapper that re-applies it
-├── server.ts                    # wrapped getTranslations
+├── sort.ts                      # pnpm i18n:sort
 └── request.ts
```

Migration, each step behaviour-neutral for users:

```text
step 1  sort the eight flat files, add the sort script, enforce in the test
        one PR, no call-site change → the conflicts stop here
step 2  one feature at a time: keys → namespace IDs, call sites → useTranslations('ns')
        codemod where the key is a literal; the flat remainder shrinks
        new strings go into a namespace from the day step 1 merges
        remainder empty → delete messageKeys.ts, translate.ts, server.ts
```

## Consequences

- Concurrent PRs stop colliding: a sorted insert lands where its key belongs,
  and features write to different namespaces.
- A wording change is one value per locale, not a rename in eight files and
  every call site.
- Call sites use next-intl's own hooks and get per-key value typing back.
- The call site no longer shows the English text; a reader opens `en.json`
  or hovers the key.
- Every new string needs a name and a namespace, and reviewers check both.
- About 2,280 literal call sites and 16 dynamic-key sites move in step 2; the
  5 `as TranslationKey` escapes map to typed namespaces or `t.has`.
- Sort order is enforced by a test, not fixed on save, until `oxfmt` sorts
  JSON.
- `apps/app/scripts/check-missing-intl-keys.ts` is replaced by the
  dictionaries test. The `i18n-strings` skill and `CLAUDE.md` change with
  step 1.

## References

- next-intl, [Translations](https://next-intl.dev/docs/usage/translations):
  "it's generally recommended to use IDs as keys"; "Namespace keys cannot
  contain the character '.'".
- PR #2042 and PR #2010: the reproduced tail conflict.
- [oxc-project/oxc#21644](https://github.com/oxc-project/oxc/issues/21644):
  open request for JSON key sorting in `oxfmt`.
