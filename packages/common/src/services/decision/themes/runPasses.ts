import { logger } from '@op/logging';

import { assertUserByAuthId } from '../../assert';
import type {
  ThemeAnalysisClaim,
  ThemeAnalysisErrorCode,
  ThemeAnalysisScope,
} from '../schemas/themeAnalysis';
import { ThemeAnalysisFailure } from './ThemeAnalysisFailure';
import { analyzeThemes } from './analyzeThemes';
import {
  type CorpusReader,
  collectProposalCorpus,
} from './collectProposalCorpus';
import { THEME_ANALYSIS_MIN_PROPOSALS } from './constants';
import { fingerprintCorpus } from './corpusFingerprint';
import type { CorpusProposal } from './corpusGrounding';
import { extractClaims } from './extractClaims';
import { findCommonGround } from './findCommonGround';

/**
 * A failure a pass reported about itself, rather than threw.
 *
 * The distinction is the whole reason this type exists. An exception thrown
 * inside `step.run` reaches the function body as an Inngest `StepError`, which
 * is rebuilt from `name`, `message` and `stack` — the class is gone, so nothing
 * downstream can ask it what went wrong. A pass that knows why it failed
 * therefore returns the answer instead.
 *
 * Returning also stops the retry. These are deterministic: a corpus with nothing
 * in it to compare will be just as empty on the second attempt, and running it
 * again costs another corpus read and another paid model call to reach the same
 * conclusion. Genuine faults still throw, and still retry.
 */
export type PassFailure = {
  ok: false;
  code: ThemeAnalysisErrorCode;
  /** Diagnostic. Recorded and logged; the app renders `code` instead. */
  message: string;
};

/**
 * Reads the corpus for a scope, reporting its own failures.
 *
 * Its own function, and its own Inngest step, because it is the half of the work
 * that is not the model. Sharing a step with the themes pass meant a run that
 * overran said only that the step was slow, and both halves competed for one
 * invocation's budget — so a slow read could exhaust the platform's patience
 * before the model was even asked. Split, each gets a full budget and Inngest
 * names the slow one without anyone reading a log.
 */
export const readCorpusForAnalysis = async ({
  processInstanceId,
  reader,
  scope,
}: {
  processInstanceId: string;
  reader: CorpusReader;
  scope: ThemeAnalysisScope;
}) => {
  // Confirm the requester still exists, then hand the corpus read an
  // auth-shaped user. Every identity path it reaches reads `user.id` as an auth
  // user id, not a database key. A system reader has no requester to confirm.
  if ('userId' in reader) {
    await assertUserByAuthId(reader.userId);
  }

  const readStartedAt = Date.now();
  const corpus = await collectProposalCorpus({
    processInstanceId,
    reader,
    scope,
  });

  const corpusChars = corpus.proposals.reduce(
    (chars, proposal) => chars + proposal.text.length,
    0,
  );

  // The size the model is about to be asked to read, recorded before it is
  // asked. A pass that then runs long is explained by this line or contradicted
  // by it, and those point at opposite fixes.
  logger.info('Theme analysis corpus read', {
    processInstanceId,
    scope,
    // Three counts, because an empty corpus has two very different causes and
    // one number cannot tell them apart. `total` is the scope's count query,
    // `read` is what the data query returned, `analyzed` is what survived the
    // empty-body drop. Whichever step of that chain lost the proposals is the
    // one to fix.
    read: corpus.read,
    analyzed: corpus.proposals.length,
    total: corpus.total,
    corpusChars,
    elapsedMs: Date.now() - readStartedAt,
  });

  // The request checked the count for this scope. This checks the corpus, which
  // is a different number: a proposal with no body text is read and dropped, so
  // a phase of empty drafts reaches here as nothing to compare. Reported so the
  // facilitator learns why, rather than as an empty analysis that reads as a
  // finding.
  if (corpus.proposals.length < THEME_ANALYSIS_MIN_PROPOSALS) {
    return {
      ok: false as const,
      code: 'not-enough-text' as const,
      // All three counts, for the reason they are all logged: "0 of 8 have text"
      // is the wrong diagnosis when the read returned nothing at all, and that
      // sentence gives no way to notice.
      message: `Nothing to compare in scope '${scope}': counted ${corpus.total} proposals, read ${corpus.read}, and ${corpus.proposals.length} had text to analyse.`,
    };
  }

  return {
    ok: true as const,
    proposals: corpus.proposals,
    total: corpus.total,
    // Computed here, over the corpus as read, so the caller can ask whether
    // this exact text has been analysed before without a second read.
    fingerprint: fingerprintCorpus(corpus.proposals),
  };
};

/**
 * Runs the claims pass over a corpus already read.
 *
 * First of the three model passes, and the only one that reads proposals. Both
 * passes after it group and reason about the claims instead, so its output has
 * to stay fixed for the rest of the run: each answers in claim indexes, and a
 * second extraction returning a different set would silently renumber what they
 * are pointing at.
 */
export const runClaimsPass = async ({
  proposals,
}: {
  proposals: CorpusProposal[];
}) => {
  try {
    return { ok: true as const, claims: await extractClaims(proposals) };
  } catch (error) {
    return toPassFailure(error);
  }
};

/**
 * Runs the themes pass over the claims the first pass extracted.
 *
 * Takes the claims rather than extracting them, so each pass sits in its own
 * step, and so both ground against the same claim list — which is what their
 * indexes point into.
 */
export const runThemesPass = async ({
  claims,
}: {
  claims: ThemeAnalysisClaim[];
}) => {
  try {
    return { ok: true as const, themes: await analyzeThemes(claims) };
  } catch (error) {
    return toPassFailure(error);
  }
};

/**
 * Runs the common-ground pass over the claims and the corpus.
 *
 * Independent of the themes pass's output, which is what lets the caller run
 * the two at once: the claims are an input both share rather than one pass's
 * result. See {@link findCommonGround}.
 */
export const runCommonGroundPass = async ({
  claims,
  proposals,
}: {
  claims: ThemeAnalysisClaim[];
  proposals: CorpusProposal[];
}) => {
  try {
    return {
      ok: true as const,
      analysis: await findCommonGround({ claims, corpus: proposals }),
    };
  } catch (error) {
    return toPassFailure(error);
  }
};

/**
 * Classifies a pass's error, re-throwing anything that is not the model failing
 * to answer usefully.
 *
 * Narrow on purpose. A `ThemeAnalysisFailure` means the reply was unusable and
 * a retry would only buy another one; anything else — the database, the network,
 * a bug — is a fault this cannot describe and should not swallow, so it goes up
 * and Inngest retries it.
 */
const toPassFailure = (error: unknown): PassFailure => {
  if (error instanceof ThemeAnalysisFailure) {
    return { ok: false, code: error.code, message: error.message };
  }

  throw error;
};
