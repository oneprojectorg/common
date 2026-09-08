# Working on the prototype

For design. Engineering wants [`HANDOFF.md`](./HANDOFF.md).

Everything here happens on the **`26Q3-process-setup`** branch. It is not going
to be merged — it exists to hold the prototype and to be the thing the team
looks at.

## Run it

```bash
git clone git@github.com:oneprojectorg/common.git
cd common
git checkout 26Q3-process-setup

pnpm install --filter @op/prototype...   # only the design system, not the whole app
pnpm -C apps/prototype dev               # http://localhost:3120
```

That last command is a live dev server — edits show up in the browser without a
refresh. It is the fastest way to see anything you change, faster than any
published link, so keep it open while you work.

The `--filter @op/prototype...` matters: a plain `pnpm install` pulls Next, tRPC,
the database layer and Playwright, none of which this needs.

Reset the prototype's data at any time from the browser console:

```js
localStorage.removeItem('op-prototype-processes');
```

## Change something

The screens are listed in [`HANDOFF.md`](./HANDOFF.md#where-the-screens-live).
Working with Claude Code in this directory is the intended way in — there is a
`CLAUDE.md` here that gives it the rules automatically, so it will know things
like which token to reach for and which parts are load-bearing.

Before you push:

```bash
pnpm -C apps/prototype build
```

**Rebuild before every push.** The built page is committed to the branch (see
below), so if you change the source and don't rebuild, the file the rest of the
team is looking at quietly stops matching the branch. This is the one manual
seam in the setup.

Then commit the source **and** `apps/prototype/dist/index.html` together.

## Update the shared link

The team's link is a Netlify site. It is not connected to the repo, so it does
not update on push — someone updates it deliberately, which is also a feature:
half-finished work does not appear in front of the team.

To refresh it, no clone or build required:

1. On GitHub, open the branch → `apps/prototype/dist/index.html` → **Download raw**
2. Go to the Netlify site → **Deploys** tab
3. Drag the file onto the drop zone there

Two things that will bite:

- **It must be `index.html`, not `artifact.html`.** Only `index.html` is a
  standalone page; the other is a fragment that expects a host to supply its
  `<head>`, and it renders broken on its own. The repo is set up so that only
  `index.html` can be committed, so if you are taking the file from GitHub you
  cannot get this wrong.
- **Drop it on the site's Deploys tab, not on Netlify's "new project" page.**
  The new-project page creates a *brand new site with a new URL* every time,
  which quietly breaks the one link everyone has.

## The three places this shows up

| where | how fresh | who it is for |
| --- | --- | --- |
| `localhost:3120` | live, every keystroke | you, while working |
| the Netlify link | whenever someone drops the file | the team |
| a Claude artifact | whenever its owner republishes | whoever published it |

The artifact is worth understanding so it does not confuse you: it is a **manual
upload**, with no connection to git. It cannot pull from the branch, and only
the person who created one can replace it. If you publish from your own Claude
session you will get your own URL rather than updating anybody else's — which is
fine, just say which link you mean when you share it.
