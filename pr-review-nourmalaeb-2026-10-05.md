# Open PRs by `nourmalaeb` — oneprojectorg/common

Generated 2026-10-05. **37 open PRs** (9 ready for review, 28 draft). Sorted oldest first.

## Headline

- **Every one of the 37 is older than 3 days.** The youngest is 13 days; the oldest, #491, has been open **255 days** (since 2026-01-23).
- **8 PRs have failing CI.**
- **22 PRs have merge conflicts** against their base (`mergeable_state: dirty`).
- **Review coverage is near zero**: exactly 1 approval across all 37 (#1501), 1 changes-requested (#2074), 2 with comments only. 33 PRs have never been reviewed by anyone.
- No PR in the set has a requested reviewer recorded.

## Needs attention first

### Red CI (8)

| PR | Age | Draft | Failing checks |
|---|---|---|---|
| [#1188](https://github.com/oneprojectorg/common/pull/1188) | 139d | yes | Typecheck |
| [#1368](https://github.com/oneprojectorg/common/pull/1368) | 104d | yes | E2E Tests (shard 1/2) |
| [#1396](https://github.com/oneprojectorg/common/pull/1396) | 103d | yes | E2E Tests (shard 1/2) — inherited from #1368 |
| [#1617](https://github.com/oneprojectorg/common/pull/1617) | 80d | yes | Typecheck, Tests, Build E2E |
| [#1759](https://github.com/oneprojectorg/common/pull/1759) | 55d | yes | Tests |
| [#2089](https://github.com/oneprojectorg/common/pull/2089) | 18d | yes | Publish, Measure, Typecheck, ADR numbers, Announce, Build E2E |
| [#2138](https://github.com/oneprojectorg/common/pull/2138) | 14d | yes | ADR numbers |
| [#2148](https://github.com/oneprojectorg/common/pull/2148) | 13d | yes | E2E Tests (shard 1/2) |

Two worth a closer look:

- **#2089** is a docs-only ADR PR failing six checks including Typecheck and Build E2E. A docs change shouldn't be able to break the build — either the branch has drifted badly or something non-docs rode along.
- **#1617** is the broadest breakage (Typecheck + Tests + Build E2E), which cascaded into A11y Baseline, the E2E matrix and Supabase Preview being skipped.

### Ready for review and blocked (non-draft)

| PR | Age | Title | Merge | Review | CI |
|---|---|---|---|---|---|
| [#491](https://github.com/oneprojectorg/common/pull/491) | **255d** | chore(styles): custom tailwind-merge config | conflicts | none | green |
| [#1098](https://github.com/oneprojectorg/common/pull/1098) | 157d | feat(auth): typed error UX for SSO sign-in | conflicts | none | green |
| [#1491](https://github.com/oneprojectorg/common/pull/1491) | 96d | feat(decisions): highlight required proposal fields on failed submit | conflicts | none | green |
| [#1501](https://github.com/oneprojectorg/common/pull/1501) | 95d | feat(decisions): render per-phase banners on phase pages | clean | **approved** (scazan, on current head) | green |
| [#1527](https://github.com/oneprojectorg/common/pull/1527) | 91d | feat(decisions): per-phase hero image API | conflicts | none | green |
| [#1528](https://github.com/oneprojectorg/common/pull/1528) | 91d | refactor(decisions): unify overview + phase banner edit components | clean | none | green |
| [#1537](https://github.com/oneprojectorg/common/pull/1537) | 91d | fix(app): deterministic phase dates across SSR/hydration (React #418) | conflicts | none | green |
| [#2076](https://github.com/oneprojectorg/common/pull/2076) | 20d | feat(db): add decision_process_phases table | clean | comments only (valentin0h, scazan x2, greptile) | green |
| [#2147](https://github.com/oneprojectorg/common/pull/2147) | 13d | feat(db): add PHASE to the EntityType enum | clean | greptile bot comment only | green |

**#1501 is the single closest-to-mergeable PR in the set** — approved, green, clean. But it's the top of a three-PR stack (`#1527 → #1528 → #1501`) whose root, #1527, has conflicts with `dev`. Clearing #1527 unblocks all three.

## Full list, oldest first

| PR | Age | Draft | Title | Base | Merge | Review | CI |
|---|---|---|---|---|---|---|---|
| #491 | 255d | | chore(styles): custom tailwind-merge config | dev | conflicts | none | green |
| #1049 | 164d | D | refactor(ui): searchable select component | dev | conflicts | none | green |
| #1098 | 157d | | feat(auth): typed error UX for SSO sign-in | dev | conflicts | none | green |
| #1124 | 151d | D | feat(ui): add component-level a11y testing | dev | conflicts | none | green |
| #1160 | 143d | D | WIP: shadcn migration (Tier 1-5 + utilities) | dev | conflicts | none | **no real CI** (only CodeQL ran; 92 commits, ~494 files) |
| #1161 | 143d | D | refactor(decisions): consolidate proposal editor route files | dev | conflicts | none | green |
| #1188 | 139d | D | refactor(uploads): signed-URL for remaining attachment endpoints | #1184 branch | unstable | none | **Typecheck** |
| #1275 | 118d | D | chore(sense): bump font sizes | dev | conflicts | none | green |
| #1315 | 111d | D | refactor(decisions): rename ProposalHtmlContent → HtmlContentRenderer | dev | conflicts | none | green |
| #1368 | 104d | D | feat: slash-command affordance + per-line placeholder | dev | conflicts | none | **E2E shard 1/2** |
| #1396 | 103d | D | feat(app): translate slash menu option labels | #1368 branch | unstable | none | **E2E shard 1/2** |
| #1491 | 96d | | feat(decisions): highlight required proposal fields on failed submit | dev | conflicts | none | green |
| #1501 | 95d | | feat(decisions): render per-phase banners on phase pages | #1528 branch | clean | **approved** | green |
| #1527 | 91d | | feat(decisions): per-phase hero image API | dev | conflicts | none | green |
| #1528 | 91d | | refactor(decisions): unify overview + phase banner edit components | #1527 branch | clean | none | green |
| #1530 | 91d | D | refactor(editor): buildBaseExtensions factory | dev | conflicts | none | green |
| #1531 | 91d | D | refactor(editor): single shared tiptap base | #1530 branch | clean | none | green |
| #1537 | 91d | | fix(app): deterministic phase dates across SSR/hydration | dev | conflicts | none | green |
| #1598 | 81d | D | refactor(decision): move proposal engagement gate into service layer | dev | conflicts | none | green |
| #1614 | 80d | D | fix(organization): org image uploads to signed-URL draft flow | dev | conflicts | none | green |
| #1617 | 80d | D | feat(ui): restore chart story after immer bump | dev | conflicts | none | **Typecheck, Tests, Build E2E** |
| #1653 | 73d | D | style(admin): decisions table wrapping and leading | dev | conflicts | none | green |
| #1759 | 55d | D | fix(translation): stop sending plain text to DeepL as markup | dev | conflicts | none | **Tests** |
| #1792 | 53d | D | refactor(styles): headingClasses onto the sense type scale | dev | conflicts | none | green |
| #1970 | 31d | D | refactor(sense): put prose headings on prose's own scale | dev | conflicts | none | green |
| #2074 | 20d | D | docs(adr): phases are entities with their own profiles | dev | blocked | **changes requested** (scazan); approved (valentin0h) | green |
| #2076 | 20d | | feat(db): add decision_process_phases table | dev | clean | comments only | green |
| #2089 | 18d | D | docs(adr): phase identity and permission resolution | dev | blocked | none | **6 failing** |
| #2112 | 17d | D | fix(decisions): one rule for who may steward a process | dev | clean | none | green |
| #2114 | 17d | D | feat(i18n): copy for the create-process wizard | wizard-steward | clean | none | green |
| #2115 | 17d | D | feat(decisions): create-process wizard content and sequencing | wizard-copy | clean | none | green |
| #2116 | 17d | D | feat(decisions): create-process wizard behind feature flag | wizard-content | clean | none | green |
| #2138 | 14d | D | fix(tooling): write the coverage report CRAP is scored from | dev | conflicts | none | **ADR numbers** |
| #2147 | 13d | | feat(db): add PHASE to the EntityType enum | #2076 branch | clean | bot comment | green |
| #2148 | 13d | D | feat(access): gate phase profiles at assertProfileTypeAccess sites | #2147 branch | conflicts | none | **E2E shard 1/2** |
| #2149 | 13d | D | feat(decision): mint a phase together with its profile | #2148 branch | clean | none | green |
| #2153 | 13d | D | feat(decisions): share the steward picker | dev | clean | none | green |

`D` = draft. "clean" on a stacked PR means clean against its parent branch, not against `dev`.

## Stacks

Several PRs are stacked, so their "clean" merge state is misleading — each needs its parent to land and then retargeting to `dev`:

- **phase-hero**: #1527 (conflicts, on dev) → #1528 → #1501 (approved). Root is blocked by conflicts.
- **slash-menu**: #1368 (conflicts, red E2E) → #1396. Both red with the same failure.
- **tiptap**: #1529 → #1530 (conflicts) → #1531.
- **wizard**: #2153 (on dev, clean, green) → #2114 → #2115 → #2116.
- **phases/db**: #2076 (on dev, clean, green) → #2147 → #2148 (conflicts, red E2E) → #2149.

The two phase/wizard stacks are the healthiest work in the set — both roots (#2076, #2153) are clean and green on `dev` today.

## Suggested order of attack

1. **#2076** — clean, green, on `dev`, has reviewer comments to address; landing it unblocks a four-PR stack.
2. **#2153** — clean, green, on `dev`; unblocks the wizard stack.
3. **#1527** — resolve conflicts to unblock #1528 and the already-approved #1501.
4. **#2089** — a docs PR failing Typecheck and Build E2E needs diagnosing, not just a rebase.
5. **#491 / #1098 / #1491 / #1537** — non-draft, green, no reviewer has ever looked. Either get a reviewer or close them; #491 at 255 days is long past the point of being worth rebasing.
