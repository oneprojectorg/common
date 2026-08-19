import { logger } from '@op/logging';
import { createHash, createHmac } from 'node:crypto';
import { z } from 'zod';

import { decodeContentRef, encodeContentRef } from '../contentRef';
import type {
  ModerationCategory,
  ModerationMediaItem,
  ModerationProvider,
  ModerationProviderReference,
  ModerationReport,
  ModerationScores,
  ModerationVerdict,
  ModerationWebhookInput,
} from '../types';
import {
  type ModerationFetchOptions,
  moderationFetch,
} from './moderationFetch';
import { headerValue, timingSafeStringEqual } from './verify';

// External input driving DB writes: validate the shape instead of casting.
// Every field is nullish — an unfamiliar payload (wrong webhook_type, missing
// content id, dashboard probe, schema drift) must NOT 400 the delivery; the
// parser returns no verdicts and the route acks with 200 so the provider
// stops retrying. `webhook_type` discriminates the four documented kinds
// (`decision`, `author-decision`, `incident-closed`, `analysed-content`); only
// `decision` carries a verdict. The content ref lives at `content.id` — the
// top-level `id` we used to read does not exist in the documented payload.
const checkstepWebhookSchema = z.object({
  webhook_type: z.string().nullish(),
  decision: z.string().nullish(),
  content: z
    .object({
      id: z.string().nullish(),
      type: z.string().nullish(),
    })
    .nullish(),
  violations: z
    .array(
      z.object({
        policy: z.string().nullish(),
        severity: z.string().nullish(),
      }),
    )
    // Hard cap: bounds worst-case scan cost + memory on a hostile / replayed
    // payload without hitting realistic Checkstep responses (their moderation
    // taxonomy is well under this bound). Exceeding it fails validation and
    // is acknowledged with 200 upstream.
    .max(1000)
    .nullish(),
});

const DEFAULT_API_URL = 'https://api.checkstep.com/api/v2';
// Reject webhooks whose signed `x-auth-date` is older/newer than this — a
// captured request can't be replayed indefinitely. Generous enough to absorb
// clock skew and provider retry delays.
const WEBHOOK_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Verifies Checkstep's webhook signature (docs.checkstep.com/standard):
 * `x-auth-signature` carries one or more comma-separated HMACs — two during
 * the 24h signing-key rotation window — each computed as
 * `HMAC-SHA256(key, hex(SHA-256("{body}.{date}.{nonce}")))`, hex-encoded.
 * The date and nonce ride in `x-auth-date`/`x-auth-nonce` and are part of the
 * signed content, so a parseable-but-stale date also invalidates the request.
 */
const verifyCheckstepWebhook = (
  { rawBody, headers }: ModerationWebhookInput,
  signingKey: string,
): boolean => {
  const signatureHeader = headerValue(headers, 'x-auth-signature');
  const date = headerValue(headers, 'x-auth-date');
  const nonce = headerValue(headers, 'x-auth-nonce');
  if (!signatureHeader || !date || !nonce) {
    return false;
  }

  const contentHash = createHash('sha256')
    .update(`${rawBody}.${date}.${nonce}`, 'utf8')
    .digest('hex');
  const expected = createHmac('sha256', signingKey)
    .update(contentHash, 'utf8')
    .digest('hex');

  const signatureMatches = signatureHeader
    .split(',')
    .some((candidate) => timingSafeStringEqual(candidate.trim(), expected));
  if (!signatureMatches) {
    return false;
  }

  // Replay window: the date is covered by the signature, so an attacker can't
  // forge a fresh one. An unparseable date is accepted (format isn't pinned by
  // the docs) — the signature has already vouched for the request.
  const signedAt = Date.parse(date);
  if (!Number.isNaN(signedAt)) {
    return Math.abs(Date.now() - signedAt) <= WEBHOOK_MAX_AGE_MS;
  }
  return true;
};

// Default Checkstep policy → category map, mirroring the policies configured
// on OUR Checkstep account (source: dashboard policy list, ONE-331). Policies
// are per-account (docs.checkstep.com/glossary), so a different deployment
// can override via the factory's `policyMap` option (wired to the
// `MODERATION_POLICY_MAP` env var in `provider.ts`); unmatched codes fall
// through to `other` and log a warning so taxonomy drift surfaces immediately.
//
// Our category union is narrower than the account taxonomy, so several
// policies intentionally map to broader buckets: terrorism → violence,
// self-harm / illegal / spam / PII / impersonation / disinformation /
// coordinated-capture → other. `other` still flags and hides — the category
// only drives score attribution, not enforcement.
export const DEFAULT_POLICY_MAP: Record<string, ModerationCategory> = {
  HTE: 'hate', // Hate Speech
  HRS: 'harassment', // Harassment
  CEX: 'csam', // Child Exploitation → mandatory-detach path
  TER: 'violence', // Terrorism
  SSH: 'other', // Promote suicide, self injury or eating disorder
  VLC: 'violence', // Violence
  SXC: 'sexual', // Sexual Content
  ILL: 'other', // Illegal Activities
  SPM: 'other', // Spam
  PII: 'other', // Private Information
  IMP: 'other', // Impersonation
  OBS: 'profanity', // Profanity Obscene
  DIS: 'other', // Voting Disinformation
  MANIP: 'other', // Process Manipulation via coordinated capture
};

// Default Checkstep policy codes that force a mandatory detach: child
// exploitation (`CEX`) and terrorism (`TER`) content is removed from the
// decision process outright — invisible even to admins — instead of the
// ordinary hide. Same account-level caveat as the map above; override via
// `detachPolicies` (env `MODERATION_DETACH_POLICIES`). Any violation carrying
// one of these codes escalates the verdict from `flagged` to `detach`.
export const DEFAULT_DETACH_POLICIES: readonly string[] = ['CEX', 'TER'];

// Checkstep severity buckets mapped onto our 0-1 scale.
const SEVERITY_SCORE: Record<string, number> = {
  low: 0.3,
  medium: 0.6,
  high: 1,
};

interface CheckstepViolation {
  policy?: string | null;
  severity?: string | null;
}

const post = async (
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  options?: ModerationFetchOptions,
): Promise<{ violations?: CheckstepViolation[]; id?: string }> => {
  const response = await moderationFetch(
    url,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    options,
  );

  if (!response.ok) {
    throw new Error(`Moderation provider returned ${response.status}`);
  }

  // Checkstep acks an async submission with a success status but an empty body,
  // so `response.json()` would throw "Unexpected end of JSON input". Read the
  // text and only parse when there's something there — both callers tolerate a
  // missing `id`/`violations`.
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  // A 2xx with an unusable body is still an accepted call, and both callers
  // tolerate a missing `id`/`violations` — reporting it as a failure would send
  // ops chasing a report Checkstep accepted. The non-object check is not
  // redundant: `JSON.parse('null')` succeeds and the caller throws on `.id`.
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

// Checkstep field types we express per media kind. The six simple types
// documented in `docs.checkstep.com/glossary` are text, image, audio, video,
// uri, file — so anything non-media (PDFs, DOCX, arbitrary attachments) rides
// on the generic `file` type rather than being dropped. Checkstep's exact
// analysis behaviour on `file` isn't spelled out in their public docs (past
// listing it as a valid field type); on a rejection the submit call throws
// and the round is retried, so a bad mapping fails loudly rather than
// silently under-moderating.
const CHECKSTEP_FIELD_TYPE: Record<ModerationMediaItem['kind'], string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  other: 'file',
};

// Checkstep requires a top-level `type` (its "complex type") on every content
// submission, and ships no preconfigured values — each must be created in the
// account. Ours defines a single complex type, `comment`, so every submission
// uses it. The real item kind (proposal/post/user) is preserved in the encoded
// `id`, which is what routes the verdict back, so collapsing onto one complex
// type here is lossless.
const COMPLEX_TYPE = 'comment';

// `reporter` is required, but the Report button is open to signed-out users.
// One shared sentinel, not a per-report id: distinct ids would fabricate
// distinct reporters out of a single unknown one.
const ANONYMOUS_REPORTER = 'anonymous';

// Lets the queue be filtered by origin. Checkstep requires the leading `#`.
const USER_REPORT_TAG = '#user-report';

// The only free-text field a moderator sees, and no Report entry point collects
// one — without this every case arrives with nothing explaining why. Shown in
// Checkstep's UI, not ours, so deliberately untranslated.
const DEFAULT_REPORT_REASON =
  'Reported by a community member using the in-app Report action. No free-text reason is collected at this entry point.';

const contentBody = (
  contentId: string,
  content: string,
  media: ModerationMediaItem[] = [],
  callbackUrl?: string,
) => ({
  id: contentId,
  type: COMPLEX_TYPE,
  fields: [
    { id: 'text', type: 'text', src: content },
    ...media.map((item, index) => ({
      id: `media-${index}`,
      type: CHECKSTEP_FIELD_TYPE[item.kind],
      src: item.url,
    })),
  ],
  ...(callbackUrl ? { callback_url: callbackUrl } : {}),
});

// Outcomes meaning the content is disallowed. `uphold` assumes it sustains an
// original *action* — see the caveat on `overturn`, which applies here too.
const FLAGGING_DECISIONS: readonly string[] = ['act', 'uphold', 'escalate'];
// Outcomes that explicitly clear the content. An unrecognized or missing
// decision is neither — it's treated as "not a verdict" (no action) rather
// than defaulting to clear, so vendor schema drift can't silently un-hide
// flagged content.
//
// `overturn` reverses the original action, so it clears; unmapped it would hit
// the "not a verdict" branch and leave an overturned item hidden with no path
// back. This trades fail-safe for fail-open on that one value, but a detach is
// computed before the decision gate, so CSAM/terrorism still detaches.
//
// CONFIRM WITH CHECKSTEP, for `overturn` and `uphold` together: if `overturn`
// can mean "overturn a dismissal", both mappings are backwards. `hint`
// distinguishes same-type decisions.
//
// `skip` is deliberately unmapped. `allow`/`ignore`/`clear` are not in the
// `ContentDecisionType` enum, but the webhook's vocabulary isn't pinned by the
// spec and an extra synonym is inert.
const CLEARING_DECISIONS: readonly string[] = [
  'dismiss',
  'overturn',
  'allow',
  'ignore',
  'clear',
];

const scoresFromViolations = (
  violations: CheckstepViolation[] | undefined,
  policyMap: Record<string, ModerationCategory>,
  // Memo so the same drift-warning doesn't spam the log for every downstream
  // verdict — one unknown code fires once. Owned by the provider instance so
  // two providers with different maps (e.g. in tests) warn independently.
  warnedUnknownPolicies: Set<string>,
): ModerationScores => {
  if (!Array.isArray(violations)) {
    return {};
  }
  const scores: ModerationScores = {};
  for (const violation of violations) {
    const rawPolicy = violation.policy ?? undefined;
    let category: ModerationCategory = 'other';
    if (rawPolicy) {
      const mapped = policyMap[rawPolicy];
      if (mapped) {
        category = mapped;
      } else if (!warnedUnknownPolicies.has(rawPolicy)) {
        // Log-once alert on Checkstep taxonomy drift: an unknown policy code
        // still falls through to `other` (so the flag pipeline runs), but ops
        // is notified so the map can be updated in config before scoring goes
        // stale on a whole class of violations.
        warnedUnknownPolicies.add(rawPolicy);
        logger.warn(
          `[moderation] unknown Checkstep policy code "${rawPolicy}" — extend MODERATION_POLICY_MAP to categorise it`,
          { policyCode: rawPolicy },
        );
      }
    }
    const score = violation.severity
      ? (SEVERITY_SCORE[violation.severity] ?? 0.5)
      : 0.5;
    scores[category] = Math.max(scores[category] ?? 0, score);
  }
  return scores;
};

/**
 * Checkstep moderation adapter. A platform vendor with policy-based violations,
 * a dashboard, and native appeals — implements `submitForReview` for the async
 * path. Key/URL never leak in errors.
 *
 * `policyMap` / `detachPolicies` are account-scoped (Checkstep policies are
 * configured per-account, not baked into the platform), so the caller wires
 * them from env / config. When omitted, the defaults above mirror our
 * account's dashboard taxonomy. Note `detachPolicies` REPLACES the default
 * list — an override of just `CEX` disables the TER detach; include every
 * code the deployment wants detached.
 */
export const createCheckstepProvider = ({
  apiKey,
  apiUrl = DEFAULT_API_URL,
  webhookSigningKey,
  policyMap = DEFAULT_POLICY_MAP,
  detachPolicies = DEFAULT_DETACH_POLICIES,
}: {
  apiKey: string;
  apiUrl?: string;
  /** Platform signing key from Checkstep settings; when set, inbound webhooks
   *  must carry a valid `x-auth-signature`. */
  webhookSigningKey?: string;
  /** Checkstep policy code → our category. Defaults to `DEFAULT_POLICY_MAP`. */
  policyMap?: Record<string, ModerationCategory>;
  /** Policy codes that escalate a verdict to `detach` (mandatory removal from
   *  the process, admin views included). Defaults to `DEFAULT_DETACH_POLICIES`. */
  detachPolicies?: readonly string[];
}): ModerationProvider => {
  const detachPolicySet: ReadonlySet<string> = new Set(detachPolicies);
  const warnedUnknownPolicies = new Set<string>();
  return {
    ...(webhookSigningKey
      ? {
          verifyWebhook: (input: ModerationWebhookInput) =>
            verifyCheckstepWebhook(input, webhookSigningKey),
        }
      : {}),

    // Checkstep takes one combined task (text + media fields), so it's a
    // single ref — unless there's nothing to review (no text, no media, e.g. a
    // `user` flag), in which case no task is planned and the flag stays pending
    // for manual handling rather than being auto-cleared by an empty submission.
    planReviewRefs: ({ itemType, itemId, roundId, content, media }) =>
      content.trim() || (media?.length ?? 0) > 0
        ? [encodeContentRef(itemType, itemId, roundId)]
        : [],

    submitForReview: async ({
      itemType,
      itemId,
      roundId,
      content,
      media,
      callbackUrl,
    }) => {
      const contentId = encodeContentRef(itemType, itemId, roundId);
      const result = await post(
        `${apiUrl}/content`,
        apiKey,
        contentBody(contentId, content, media, callbackUrl),
      );
      const reference: ModerationProviderReference = {
        providerRecordId: result.id ?? contentId,
        submittedRefs: [contentId],
      };
      return reference;
    },

    // Raises the human-review case. `POST /content` only feeds the classifiers,
    // so without this a report on content they read as clean reaches no
    // moderator. Same ref + complex type as the submission is what associates
    // the two; an unrecognised id still creates a case, just an isolated one.
    reportForReview: async ({
      itemType,
      itemId,
      roundId,
      reporterId,
      reason,
    }: ModerationReport): Promise<void> => {
      // No retries: this endpoint is not idempotent on the id, so a 5xx after
      // Checkstep accepted the report would file a duplicate. It also runs
      // inside a synchronous user mutation, where the default 3x5s budget would
      // add ~15s to a Report click. A drop is logged rather than retried.
      await post(
        `${apiUrl}/content/report`,
        apiKey,
        {
          id: encodeContentRef(itemType, itemId, roundId),
          type: COMPLEX_TYPE,
          reporter: reporterId ?? ANONYMOUS_REPORTER,
          tags: [USER_REPORT_TAG],
          reason: reason?.trim() || DEFAULT_REPORT_REASON,
        },
        { retries: 0 },
      );
    },

    // One verdict per callback (one combined task per submission). Checkstep
    // sends four documented webhook_type values; only `decision` carries a
    // content verdict for us — the other kinds (author-decision, incident-closed,
    // analysed-content) are acknowledged without action.
    parseWebhook: ({
      rawBody,
    }: ModerationWebhookInput): ModerationVerdict[] => {
      const payload = checkstepWebhookSchema.parse(JSON.parse(rawBody));
      if (payload.webhook_type !== 'decision') {
        return [];
      }
      const contentId = payload.content?.id;
      if (!contentId) {
        return [];
      }
      // A delivery for content not ingested through this integration (dashboard
      // test payloads, sync-gate items under a bare uuid, pre-deploy content)
      // carries an id that isn't our ref — skip it and acknowledge with 200
      // rather than throwing into a 400 + retries.
      let ref;
      try {
        ref = decodeContentRef(contentId);
      } catch {
        return [];
      }
      // Mandatory detach is decided BEFORE the decision-parse gate: even an
      // ack/interim callback with no recognized top-level decision still
      // fires the detach path if the violations name a detach policy (CEX,
      // TER by default). Any detach-policy hit wins over `flag` and `clear`.
      // Deduped so repeated violations of one policy don't render as
      // "CEX, CEX" in the audit reason.
      const detachHits = [
        ...new Set(
          (payload.violations ?? []).flatMap((v) =>
            v.policy != null && detachPolicySet.has(v.policy) ? [v.policy] : [],
          ),
        ),
      ];
      const isDetach = detachHits.length > 0;

      const flagged = payload.decision
        ? FLAGGING_DECISIONS.includes(payload.decision)
        : false;
      const cleared = payload.decision
        ? CLEARING_DECISIONS.includes(payload.decision)
        : false;
      // Neither a detach hit nor a recognized decision (unknown value, or a
      // decision-less ack/interim callback with no detach violation) → not a
      // verdict; emit nothing rather than defaulting to clear and dismissing
      // an open flag.
      if (!isDetach && !flagged && !cleared) {
        return [];
      }
      const verdict: ModerationVerdict['verdict'] = isDetach
        ? 'detach'
        : flagged
          ? 'flagged'
          : 'clear';
      // A `detach` or `flagged` verdict carries evidence; a plain `clear`
      // doesn't. Detach without a flagging decision still surfaces the
      // matched policies so ops logs the exact violation instead of an empty
      // explanation.
      const carriesEvidence = isDetach || flagged;
      return [
        {
          itemType: ref.itemType,
          itemId: ref.itemId,
          roundId: ref.roundId,
          mediaId: ref.mediaId,
          verdict,
          externalRecordId: contentId,
          reason: carriesEvidence
            ? isDetach
              ? `Checkstep detach (${detachHits.join(', ')}): ${payload.decision ?? '(no decision)'}`
              : `Checkstep decision: ${payload.decision}`
            : undefined,
          scores: carriesEvidence
            ? scoresFromViolations(
                payload.violations ?? undefined,
                policyMap,
                warnedUnknownPolicies,
              )
            : undefined,
        },
      ];
    },
  };
};
