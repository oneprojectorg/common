# Prototype (Vite)

**PROTOTYPE ONLY.** A plain React SPA whose entire job is to be *shareable*:
`pnpm build` produces one self-contained HTML file that renders the real Common
design system with no server, no database, and no Next.js behind it.

Start here depending on why you opened this:

- **Handing it to engineering** — [`HANDOFF.md`](./HANDOFF.md)
- **Designing in it** — [`DESIGNER.md`](./DESIGNER.md)
- **Working in it with Claude Code** — [`CLAUDE.md`](./CLAUDE.md)

## Why it exists

The prototype needs to look like the product, which means using `@op/sense` and
`@op/styles` rather than copying them. It does **not** need anything else the app
carries — App Router, tRPC, the database, next-intl. So it depends on the two
design-system packages as workspace siblings and nothing more.

Two facts make this work:

- `@op/sense` has **no Next.js coupling** and exports raw TSX from source, so
  Vite compiles it directly.
- Per-component imports mean the heavy optional deps (maplibre, recharts,
  tiptap) never enter the bundle.

## Commands

```bash
pnpm -C apps/prototype dev      # http://localhost:3120
pnpm -C apps/prototype build    # dist/index.html + dist/artifact.html
```

`build` emits the same page twice:

| File | Shape | For |
| --- | --- | --- |
| `dist/index.html` | standalone document | open from disk, mail it, any static host |
| `dist/artifact.html` | body fragment | the Artifact host, which supplies its own `<head>`/`<body>` |

Measured: ~1.5 MB each, and **one** network request at runtime — the Google
Fonts stylesheet.

They are **not interchangeable**: only `index.html` is a whole page. Dropping
`artifact.html` on a static host renders a broken page, so only `index.html` is
committed — see below.

## The committed build

`apps/prototype/dist/index.html` is checked in, which is unusual and deliberate:
it lets anyone refresh the team's shared link by downloading one file from
GitHub and dropping it on Netlify, with no clone, no install and no Node.

Two things follow from that:

- **Rebuild before you push.** The source and the committed page can drift, and
  nothing catches it.
- **`dist` is otherwise still ignored.** `apps/prototype/.gitignore` re-includes
  exactly one file, so `artifact.html` cannot be committed by accident.

It also means the built page is no longer hidden from Tailwind's automatic
source detection, which scans everything that is not gitignored — hence the
`@source not '../dist/**'` in `src/styles.css`. Without it every build scanned
the previous build's bundle and the stylesheet grew each time.

## How it stands in for the app

The screens are the *same files* the Next app rendered — copied, not rewritten —
so what is on screen is the product's own components and layout rather than an
imitation. What the app supplies around them is replaced by the smallest thing
that lets a screen exist:

| The app | Here |
| --- | --- |
| Next App Router | a hash router (`src/router.tsx`) — no server, so any static host works |
| `next-intl` | a shim that returns the key, since every call site passes English copy |
| `next/navigation` | a shim over the same hash router |
| tRPC + Postgres | `localStorage`, under `op-prototype-processes` |
| Auth and roles | none — every screen is the admin's view |

The shims live in `src/shims/` and are wired up by aliases in `vite.config.ts`,
so nothing inside the copied screens had to change.
