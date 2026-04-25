# PRD: Decision Updates Side Panel (MVP)

## 1. Introduction / Overview

Decision-making process pages currently have no first-class way for the people running a decision to broadcast progress, context, or news to participants. Today, organizers either rely on out-of-band channels (email, Slack) or repurpose the discussion area, which mixes announcements with conversation.

This feature adds a right-side panel to every decision-making process page with a tabbed UI. The first (and only, for MVP) tab is **Updates** — a chronological feed of admin-authored posts about the decision. Updates reuse the existing `posts` infrastructure, so they automatically inherit comments, reactions, and attachments. Only admins on the decision can author updates; everyone with read access to the decision can view, comment, and react.

The MVP is deliberately a thin vertical slice: open the panel, see the Updates tab, post an update (admin only), see it appear, react to it. Polish, additional tabs (Meetings, Resources), notifications, etc. come later.

Figma reference: https://www.figma.com/design/u4YWqQeNlAosEjs1lrsGqf/%F0%9F%99%8B-Decision-Making?node-id=3804-11005&m=dev

## 2. Goals

- Admins of a decision-making process can post updates from a side panel on the decision page.
- All decision viewers can read updates, comment on them, and react with emoji.
- Updates reuse the existing `posts` table, post composer, and post-feed UI — no new post-style schema.
- Non-admins do not see the post composer (read-only Updates feed).
- Side panel has scaffolding for three tabs (Updates, Meetings, Resources) but only Updates is functional in this MVP.
- Feature is verifiable end-to-end inside the Docker dev environment with screenshot evidence.

## 3. User Stories

### US-001: Add a side panel container to the decision page

**Description:** As a decision viewer, I want a side panel on the right of the decision page so I can access supplementary information (Updates, Meetings, Resources) without leaving the page.

**Acceptance Criteria:**
- [ ] On `/decisions/[slug]`, a side panel renders on the right of the existing content.
- [ ] Panel shows three tabs in a `TabList` from `@op/ui`: **Updates**, **Meetings**, **Resources**.
- [ ] Active tab is reflected in the URL (`?panelTab=updates`) using the same `window.history.replaceState` pattern as `ProfileTabsWithQuery`.
- [ ] Default tab is `updates` when no query param is present.
- [ ] Meetings and Resources tabs render a placeholder (e.g. "Coming soon") — they are not functional in the MVP.
- [ ] Layout works at desktop widths (≥1024px). Mobile/tablet behavior is out of scope for the MVP (the existing single-column layout may be retained below the breakpoint).
- [ ] Typecheck passes (`pnpm w:app typecheck`).
- [ ] Verify in browser using the Docker dev environment.

### US-002: Render the Updates feed inside the panel

**Description:** As a decision viewer, I want to see the chronological list of all updates posted about a decision so I can catch up on what the admins have shared.

**Acceptance Criteria:**
- [ ] Updates tab shows the title "Updates".
- [ ] Below the title, a feed of posts associated with the decision's profile renders, newest first.
- [ ] Reuses existing post-feed components (`PostItem` / `PostFeed`) — no parallel rendering code.
- [ ] Empty state ("No updates yet") shows when there are no updates.
- [ ] Each update displays: author avatar/name, timestamp, content, attachments (if any), reaction picker, comment count.
- [ ] Comments and reactions on an update use the existing post infrastructure unchanged.
- [ ] Typecheck passes.
- [ ] Verify in browser using the Docker dev environment.

### US-003: Admin posts a new update

**Description:** As an admin on a decision-making process, I want to post an update from the side panel so I can share progress with participants.

**Acceptance Criteria:**
- [ ] When `processInstance.access.admin === true`, the existing `PostUpdate` composer renders at the top of the Updates feed (below the "Updates" title, above the list).
- [ ] When `access.admin` is false or undefined, the composer is **not rendered** (defense-in-depth on top of server-side enforcement).
- [ ] Submitting the composer creates a post associated with the decision's profile (via existing `posts.createPost` or equivalent path used for profile-scoped posts).
- [ ] After submission, the new update appears at the top of the feed without a full-page reload.
- [ ] Typecheck passes.
- [ ] Verify in browser using the Docker dev environment.

### US-004: Server-side authorization for posting updates

**Description:** As a platform engineer, I want the server to reject update-post attempts from non-admins so we cannot rely solely on the client hiding the composer.

**Acceptance Criteria:**
- [ ] The server-side path that creates an update verifies the caller has `access.admin === true` on the target decision (using the same access derivation already used by `processInstance.access`).
- [ ] If the caller is not an admin, the request is rejected with `FORBIDDEN`.
- [ ] Read paths (listing updates, commenting on updates, reacting to updates) do **not** require admin — any user with read access to the decision can do these.
- [ ] Existing posts authorization for non-decision posts is unchanged.
- [ ] Typecheck passes.

### US-005: End-to-end verification in Docker dev environment

**Description:** As the user shipping this feature, I want documented proof that the full flow works inside the Docker dev environment, captured as screenshots.

**Acceptance Criteria:**
- [ ] `pnpm docker:dev` boots the stack; app reachable at `http://localhost:3100`.
- [ ] Log in as a seeded user (or sign up a fresh one) and create a new decision-making process, filling in all required fields so the process is in a normal admin state.
- [ ] Open the new decision page; the right-side panel is visible with the **Updates / Meetings / Resources** tabs and Updates selected by default. **Capture screenshot 1** (`tasks/screenshots/01-side-panel-empty.png`).
- [ ] As an admin on this decision, post a new update via the composer. **Capture screenshot 2** (`tasks/screenshots/02-update-posted.png`) showing the new update at the top of the feed.
- [ ] React to the new update with an emoji reaction. **Capture screenshot 3** (`tasks/screenshots/03-update-reaction.png`) showing the reaction count incremented on the update.
- [ ] All three screenshots are committed to the repo under `tasks/screenshots/` so reviewers can see the evidence without booting the stack themselves.
- [ ] Browser console shows no errors during the flow (or any errors are documented and triaged).

## 4. Functional Requirements

- FR-1: The decision page (`apps/app/src/app/[locale]/(no-header)/decisions/[slug]/page.tsx` and its layout/content components) must render a right-side panel container at desktop widths.
- FR-2: The side panel must contain a `Tabs` component (`@op/ui/Tabs`) with three tabs in order: Updates, Meetings, Resources.
- FR-3: The active tab must be controlled by a URL query param (`panelTab`), defaulting to `updates`.
- FR-4: The Meetings and Resources tab panels must render a "Coming soon" placeholder.
- FR-5: The Updates tab panel must show: a heading "Updates", an admin-only post composer, and a chronological list of updates (newest first).
- FR-6: The post composer must only render when `processInstance.access.admin === true`.
- FR-7: Updates must be stored as rows in the existing `posts` table, scoped to the decision's profile (using the same `profileId` association used by profile updates today).
- FR-8: Listing updates must reuse the existing post-fetch path (e.g. `trpc.posts.getPosts({ profileId })` or its equivalent) — do not introduce a parallel "decision updates" fetch.
- FR-9: Comments on an update must work via the existing `parentPostId` mechanism with no changes.
- FR-10: Reactions on an update must work via the existing `postReactions` table with no changes.
- FR-11: The server must enforce that only decision admins can create an update; non-admins receive `FORBIDDEN`.
- FR-12: After a successful post creation, the feed must reflect the new update without a full page reload (refetch / cache invalidation).
- FR-13: When there are no updates, the feed must show an empty-state message ("No updates yet" or equivalent).

## 5. Non-Goals (Out of Scope)

- **Meetings tab functionality** — placeholder only; no scheduling, no list, no integrations.
- **Resources tab functionality** — placeholder only; no file browser, no links list.
- **Mobile / responsive behavior** for the side panel — desktop layout only for the MVP. Smaller breakpoints may keep the existing single-column layout or hide the panel.
- **Push / email notifications** when a new update is posted.
- **Pinning, editing, or deleting updates** beyond what comes for free with existing post UI. (Existing post delete behavior may apply; we are not adding new admin-only update-management UI.)
- **Distinguishing "updates" from regular profile posts at the schema level** — they are the same row in `posts`. If existing profile-post UIs render these on profile timelines, that is acceptable for the MVP; revisit if it causes confusion.
- **Granular per-decision admin role separate from profile admin** — we use the existing `processInstance.access.admin` flag.
- **Rich filtering, search, or pagination beyond what existing post-feed components already do.**
- **Analytics / engagement metrics** on updates.

## 6. Design Considerations

- Figma source of truth: https://www.figma.com/design/u4YWqQeNlAosEjs1lrsGqf/%F0%9F%99%8B-Decision-Making?node-id=3804-11005&m=dev
- Reuse `@op/ui/Tabs` (`packages/ui/src/components/Tabs.tsx`) for the tab strip.
- Reuse the post composer (`apps/app/src/components/PostUpdate`) and post feed (`apps/app/src/components/PostFeed`) verbatim where possible. Only wrap them with the panel + heading.
- Use design tokens for colors and the project type scale for text — no arbitrary Tailwind values.
- The panel should feel like a sibling of the main decision content, not a modal/drawer. A flex `lg:flex-row` split with the panel pinned to the right at a fixed/min width is appropriate.

## 7. Technical Considerations

- **Posts schema**: Posts are in `services/db/schema/tables/posts.sql.ts`. Posts on a profile are looked up via `profileId` and/or the `postsToProfiles` junction; reuse whichever is already used by profile updates so updates show up consistently.
- **Decision admin check**: `processInstance.access.admin` is already computed by `services/api/src/encoders/decision.ts` and surfaced in the existing decision data. Use it on the client to gate the composer. On the server, replicate the same access derivation to enforce posting permission.
- **Reuse existing tRPC routes**: prefer `trpc.posts.createPost` / `trpc.posts.getPosts` over inventing decision-specific routes. If the server-side admin check needs an extra context, add it as a precondition in the existing `createPost` path (when targeting a decision's profile) rather than forking the procedure.
- **URL state**: Follow `ProfileTabsWithQuery` (`apps/app/src/components/Profile/ProfileContent/ProfileTabsWithQuery.tsx`) for tab state in URL — `window.history.replaceState` to avoid race conditions.
- **Suspense + error boundaries**: Per CLAUDE.md, prefer suspense queries with proper error boundaries over `useQuery + useEffect`.
- **No `any`, no `as`**: Per CLAUDE.md, do not use type assertions or `any` to silence type errors.
- **Translations**: All user-facing strings ("Updates", "Meetings", "Resources", "Coming soon", "No updates yet", composer placeholder) must be wrapped with `t('...')` and added to `apps/app/src/lib/i18n/dictionaries/en.json` (other locales can fall back).
- **Migrations**: This feature should require **no schema migration**. If implementation reveals a need for one, flag it before writing it — `pnpm w:db generate` only, never `migrate`.

## 8. Verification Plan (Docker Dev Environment)

This is the concrete sequence US-005 references. The implementing agent must execute it and capture the screenshots before declaring the work done.

1. From the worktree root, run `pnpm docker:dev` (or `pnpm docker:dev:build` on first run). Wait for the app container to report it is listening on `:3100`.
2. If migrations or seed data are needed for a fresh DB, run `pnpm docker:migrate` and `pnpm docker:seed`.
3. Browse to `http://localhost:3100` and sign in (or sign up + verify via the local inbucket on `http://localhost:3124` if email confirmation is required).
4. Navigate to the decision-making process creation flow and create a new process, filling **all required fields** so the process reaches a normal post-creation admin view.
5. On the new decision page, confirm the side panel is visible on the right with the three tabs and Updates active. **Capture `tasks/screenshots/01-side-panel-empty.png`.**
6. Use the composer to post an update with a short body (e.g. "First update — testing the side panel."). Verify it appears at the top of the feed. **Capture `tasks/screenshots/02-update-posted.png`.**
7. Click an emoji reaction on the new update. Verify the reaction count goes from 0 → 1 and your reaction is highlighted. **Capture `tasks/screenshots/03-update-reaction.png`.**
8. Open the browser dev console; confirm no errors during the above steps. Note any warnings.
9. Commit the three screenshots to `tasks/screenshots/` so reviewers can verify without booting the stack.

## 9. Success Metrics

- Admin can post an update in ≤ 2 clicks (open panel → click composer → type → submit) once on the decision page.
- Update appears in the feed within 1s of submission on a local dev environment.
- Zero new TypeScript errors introduced (`pnpm w:app typecheck` clean).
- Three verification screenshots are present in `tasks/screenshots/` and accurately depict the empty panel, posted update, and reacted update.

## 10. Open Questions

- **Visibility of decision updates on profile timelines**: Since updates are stored as profile-scoped posts, do they appear on the decision profile's own timeline (if such a timeline exists)? Acceptable for MVP, but worth confirming so we don't surprise users.
- **Admin role source**: Is `processInstance.access.admin` always sufficient, or are there decision states (closed/archived) where we should still hide the composer for admins? MVP assumes "admin can always post"; revisit if user feedback suggests otherwise.
- **Tab placeholder copy**: Confirm exact copy / illustration for the Meetings and Resources placeholders, or accept generic "Coming soon" for now.
- **Mobile fallback**: Should the side panel collapse to a tab/drawer on mobile, or be hidden entirely? MVP hides/ignores; design follow-up needed.
