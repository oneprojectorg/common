import { assertUserByAuthId } from '../../assert';
import type {
  ThemeAnalysisErrorCode,
  ThemeAnalysisTheme,
} from '../schemas/themeAnalysis';
import { ThemeAnalysisFailure } from './ThemeAnalysisFailure';
import { analyzeThemes } from './analyzeThemes';
import { collectProposalCorpus } from './collectProposalCorpus';
import { THEME_ANALYSIS_MIN_PROPOSALS } from './constants';
import type { CorpusProposal } from './corpusGrounding';
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
 * Reads the corpus and runs the themes pass, reporting its own failures.
 *
 * The corpus travels back with the themes because the second pass must read the
 * same one: the indexes the themes pass grounded against are positions in this
 * list, and a re-read that returned a different set would silently renumber
 * them.
 */
export const runThemesPass = async ({
  processInstanceId,
  userId,
}: {
  processInstanceId: string;
  userId: string;
}) => {
  // Confirm the requester still exists, then hand the corpus read an
  // auth-shaped user. Every identity path it reaches reads `user.id` as an auth
  // user id, not a database key.
  await assertUserByAuthId(userId);

  const corpus = await collectProposalCorpus({ processInstanceId, userId });

  // The request checked the phase's count. This checks the corpus, which is a
  // different number: a proposal with no body text is read and dropped, so a
  // phase of three empty drafts reaches here as nothing to compare. Reported so
  // the facilitator learns why, rather than as an empty analysis, which would
  // read as a finding.
  if (corpus.proposals.length < THEME_ANALYSIS_MIN_PROPOSALS) {
    return {
      ok: false as const,
      code: 'not-enough-text' as const,
      message: `Only ${corpus.proposals.length} of this phase's ${corpus.total} proposals have any text to analyse.`,
    };
  }

  try {
    return {
      ok: true as const,
      themes: await analyzeThemes(corpus.proposals),
      proposals: corpus.proposals,
      total: corpus.total,
    };
  } catch (error) {
    return toPassFailure(error);
  }
};

/** Runs the common-ground pass over the corpus the themes pass read. */
export const runCommonGroundPass = async ({
  themes,
  proposals,
}: {
  themes: ThemeAnalysisTheme[];
  proposals: CorpusProposal[];
}) => {
  try {
    return {
      ok: true as const,
      analysis: await findCommonGround({ themes, corpus: proposals }),
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
