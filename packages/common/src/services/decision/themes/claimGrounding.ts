import type { ThemeAnalysisClaim } from '../schemas/themeAnalysis';
import { ThemeAnalysisFailure } from './ThemeAnalysisFailure';

/**
 * Grounding for the passes that read claims, mirroring `corpusGrounding` one
 * level down.
 *
 * Once claims exist they are what the later passes group and reason about, so
 * they need the same treatment the corpus gets: numbered for the prompt, fenced
 * so a claim cannot end its own document, and resolved back from indexes so a
 * reply cannot name something that was never extracted. The reasoning is
 * identical — a model that answers in positions can be checked against the list
 * it was shown, and one that answers in free text cannot.
 */

/**
 * Refuses an empty claim list before the model is asked to group it.
 *
 * The counterpart of `assertCorpusHasProposals`, and there for the same reason:
 * a pass handed nothing renders "these 0 claims" followed by an empty list and
 * asks anyway, which is a paid call whose best outcome is an empty grouping that
 * reads as a finding.
 *
 * A corpus with text in it can still yield no claims — every proposal might be
 * a description with nothing assertable in it — so this is a reachable state
 * rather than a defensive one.
 *
 * @param claims - The claims the pass is about to render.
 * @param pass - Pass name, for the diagnostic.
 * @throws ThemeAnalysisFailure when there are no claims.
 */
export const assertClaimsArePresent = (
  claims: ThemeAnalysisClaim[],
  pass: string,
): void => {
  if (claims.length === 0) {
    throw new ThemeAnalysisFailure(
      'not-enough-text',
      `The ${pass} pass was handed no claims, so the model was not asked.`,
    );
  }
};

/**
 * Resolves claim indexes the model returned back to the claims they name.
 *
 * Out-of-range and duplicate indexes are dropped, exactly as
 * `resolveCorpusIndexes` drops them for proposals: an invented position is
 * detectable where an invented claim string would read as a real one, and a
 * theme listing the same claim twice renders as two identical lines.
 *
 * @param indexes - One-based positions from a parsed model reply.
 * @param claims - The claims the model was shown.
 * @returns The named claims, in the order the model gave them.
 */
export const resolveClaimIndexes = (
  indexes: number[],
  claims: ThemeAnalysisClaim[],
): ThemeAnalysisClaim[] => {
  const seen = new Set<number>();

  return indexes.flatMap((index) => {
    if (index < 1 || index > claims.length || seen.has(index)) {
      return [];
    }

    seen.add(index);

    const claim = claims[index - 1];

    // Unreachable given the bounds check above; `noUncheckedIndexedAccess`
    // needs it said, and saying it here beats a non-null assertion.
    if (!claim) {
      return [];
    }

    return [claim];
  });
};

/**
 * The distinct proposals a set of claims came from, in first-seen order.
 *
 * Deriving this is what keeps a theme honest. Asking the model for the claims
 * *and* the proposals would give two lists that can disagree, and the one a
 * reader checks is the proposals — so a theme could name a proposal none of its
 * claims came from and look perfectly sound.
 *
 * Typed off the claim's own proposal rather than restated, so a field added to
 * an analysed proposal — `profileId`, which the dialog links through — reaches
 * a theme's proposals without this function being edited to let it past.
 *
 * @param claims - The claims grouped under one theme.
 * @returns Their proposals, deduplicated by id.
 */
export const proposalsBehindClaims = (
  claims: ThemeAnalysisClaim[],
): Array<ThemeAnalysisClaim['proposal']> => {
  const seen = new Set<string>();

  return claims.flatMap(({ proposal }) => {
    if (seen.has(proposal.id)) {
      return [];
    }

    seen.add(proposal.id);

    return [proposal];
  });
};

/**
 * Renders the claims as the numbered, fenced list the later prompts embed.
 *
 * Each claim carries the proposal it came from, because the passes that read
 * this need it: the themes pass is told to group across proposals rather than
 * within them, and the common-ground pass cannot suggest splitting a proposal
 * without knowing which claims are its.
 *
 * The claim text is the model's own restatement from the previous pass, and the
 * quote is participant-written. Both are escaped: text that reaches a prompt
 * from outside gets fenced whatever produced it, and the claim came out of a
 * reply to a corpus a member of the public wrote.
 *
 * @param claims - The claims to render, in the order they are numbered.
 * @returns The block to embed in a prompt.
 */
export const renderClaimsForPrompt = (claims: ThemeAnalysisClaim[]): string =>
  claims
    .map(
      ({ claim, proposal }, position) =>
        `<claim index="${position + 1}" proposal="${escapeForFence(proposal.title || 'Untitled proposal')}">\n${escapeForFence(claim)}\n</claim>`,
    )
    .join('\n\n');

/**
 * Neutralises the fence characters in text that reaches a prompt.
 *
 * The same function as `corpusGrounding`'s, for the same reason: a fence a
 * document can close is not a fence. Duplicated rather than shared because the
 * two modules are deliberately independent — `corpusGrounding` is about
 * proposals and this is about claims, and a shared private helper would tie the
 * two files together for four lines.
 */
const escapeForFence = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
