# NNNN. Route LLM inference through `@op/ai` on OpenAI-compatible endpoints

Date: 2026-10-20

## Status

Accepted

## Context

Common has no LLM feature in production. An earlier `llm` tRPC router called
Anthropic through the Vercel AI SDK and was removed in
[#337](https://github.com/oneprojectorg/common/pull/337); its dependencies
stayed in two manifests. [#1631](https://github.com/oneprojectorg/common/pull/1631)
added `packages/ai` as the path for the next feature, but no ADR records what
it commits us to.

Planned features are summaries for proposal cards, category suggestions, and
duplicate-proposal detection. One Project also wants organizations to run
Common against inference they choose, including self-hosted models.

In scope: which library wraps inference, which provider API we speak, and
where the endpoint and credential come from. Out of scope: which model a
feature uses, prompt text, and evaluation.

## Decision

We will make `@op/ai` (`packages/ai`) the only path to LLM inference. No app
or service imports a provider SDK directly.

`@op/ai` wraps [Mastra](https://mastra.ai) as a library. We do not use Mastra
Cloud, and the package disables Mastra telemetry unconditionally.

We will speak only the OpenAI-compatible chat API. Mastra's model router sends
a model id, URL, and key to any such endpoint, so we add no per-vendor SDK.

Each agent names its model in code. There is no `AI_MODEL` env var, so
features can run different models side by side.

The endpoint and key are runtime config. A caller passes `baseURL` and
`apiKey`, for example from an organization's settings. `AI_BASE_URL` and
`AI_API_KEY` are deploy-level fallbacks for the env endpoint only. The deploy
key is never attached to a caller-supplied endpoint, and an explicit empty key
means keyless, for a self-hosted endpoint such as Ollama or vLLM.

## Consequences

- One package to review for prompt, cost, and credential handling. The first
  consumer must add timeouts, token caps, and request logging there.
- A provider without an OpenAI-compatible endpoint needs a proxy or a new ADR.
- Vendor-specific features such as prompt caching are unavailable unless the
  endpoint exposes them through the OpenAI-compatible API.
- The workspace carries Mastra core before any feature uses it.
- Prompts live in the app, so evaluation suites must load them from the app's
  files rather than keeping their own copies.

## References

- [Mastra model routing](https://mastra.ai/docs/models/overview)
- [#1631](https://github.com/oneprojectorg/common/pull/1631) bootstraps `@op/ai`.
