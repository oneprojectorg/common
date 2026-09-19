# zoom-bot

A Zoom Team Chat bot that answers questions about how our product behaves by
reading this codebase. Teammates DM it or type `/ask <question>` in a channel;
it replies in plain language a minute or two later.

## How it works

1. Zoom posts a `bot_notification` webhook to `/api/zoom`; we verify its
   signature and answer `200` immediately so Zoom does not retry.
2. The work continues in `after()`: we post "Looking into it…" to the channel.
3. We start one Anthropic **Managed Agents** session with this repo mounted
   read-only at `/workspace/common`, and send the question.
4. We stream the session's events and collect the agent's text.
5. We post the answer back to Zoom with a trace link for engineers.

No database, no queue, no follow-up threading — one session per question.

## Monday-morning checklist

Everything below needs an account we do not have in CI, so it is all manual and
one-time.

### 1. Anthropic

- Create an API key in the Claude Console (<https://platform.claude.com>).
- `export ANTHROPIC_API_KEY=...`
- `pnpm w:zoom-bot run setup` (the `run` is required — `pnpm setup` is a
  built-in pnpm command that would shadow the script)
- Copy the two ids it prints: `ANTHROPIC_ENVIRONMENT_ID` and
  `ANTHROPIC_AGENT_ID`.

### 2. GitHub

- Create a **fine-grained** personal access token scoped to
  `oneprojectorg/common` only, with **Contents: Read** (Metadata: Read is
  implied and added automatically). Nothing else.
- This token is only ever sent to Anthropic's session-create API. Their git
  proxy injects it when cloning; it never enters the agent's sandbox.

### 3. Vercel

- New Project → import this repo → **Root Directory `apps/zoom-bot`**,
  framework preset Next.js.
- Add every variable from [`.env.example`](./.env.example).
- Deploy, then note the webhook URL: `https://<project>.vercel.app/api/zoom`.
- If answers start getting cut short, enable **Fluid compute** for the project
  and raise `maxDuration` in `app/api/zoom/route.ts` (300 → 800 seconds).

### 4. Zoom Marketplace

Go to <https://marketplace.zoom.us> → Develop → Build App → **General App**,
account-level. Zoom's UI labels shift between releases, so look for these
concepts rather than these exact button names.

- Enable the **Team Chat** feature (the chatbot), and set the bot's name.
- Copy the **Client ID**, **Client Secret** and **Bot JID**.
- Add a slash command: `ask`.
- Under Features → Access, enable **Event Subscription**. Add the endpoint URL
  from step 3 and copy the **Secret Token**.
- Subscribe to the chatbot `bot_notification` events.
- Scopes: `imchat:bot`, plus whatever else Team Chat asks for.

Zoom validates the endpoint the moment you save it, so **deploy with
`ZOOM_WEBHOOK_SECRET_TOKEN` already set first**, then save the subscription.

Finally, use **Local Test / Add** to install the app on our account.

### 5. Test

DM the bot `what permissions does an invited process member get?`, or use
`/ask …` in a channel. Expect "Looking into it…" straight away and the answer
within one to three minutes.

When it fails, look at: the Vercel function logs for that request, and the
trace URL the bot prints at the bottom of every answer.

### 6. Optional lockdown

- Set `ZOOM_ACCOUNT_ID` to our Zoom account id so webhooks from anywhere else
  are ignored.
- Adjust `SESSION_BUDGET_CENTS` (default `300` = $3.00 per question).

### 7. Changing the bot's behaviour

Edit [`agent/system-prompt.md`](./agent/system-prompt.md) and re-run
`pnpm w:zoom-bot run setup`. That creates a new agent version; the app always uses
the latest one, so no redeploy is needed.

## Cost

One Managed Agents session per question, hard-capped by
`SESSION_BUDGET_CENTS`. Session runtime is billed by the hour on top of the
model tokens, so an idle session is not free — we never keep one open between
questions.
