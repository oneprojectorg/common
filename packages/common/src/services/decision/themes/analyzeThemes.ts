import type {
  ThemeAnalysisClaim,
  ThemeAnalysisTheme,
} from '../schemas/themeAnalysis';
import { themesPassReplySchema } from '../schemas/themeAnalysis';
import { askForJson } from './askForJson';
import {
  assertClaimsArePresent,
  proposalsBehindClaims,
  renderClaimsForPrompt,
  resolveClaimIndexes,
} from './claimGrounding';

const INSTRUCTIONS = `You are given the claims made by the proposals submitted to a participatory decision process, and you group them into themes.

A theme is something several claims are about, named the way a participant would recognise it. "Safer routes to school" is a theme. "Community" is a category, and categories tell a facilitator nothing they did not already know.

Group by what the claims say, not by which proposal they came from. Two claims from the same proposal belong in different themes when they argue different things — that is the ordinary case, not an edge case, and it is why you are reading claims rather than proposals. Equally, claims from a dozen proposals belong in one theme when they are making the same point.

Report at most eight themes, in importance order. Every theme lists the claims it groups, by their index. A claim that fits no theme is left out; do not invent a theme to hold one stray claim, and do not report a theme no claim carries.

Answer with an object holding one key, "themes", whose value is an array of objects with:
- "title": the theme, at most a short phrase
- "summary": one or two sentences on what the claims in it are saying
- "claimIndexes": the indexes of the claims it groups`;

/**
 * The themes running through a corpus of claims — the second of the three
 * passes.
 *
 * Groups claims rather than proposals, which is the change claims were extracted
 * for. Grouping documents makes a proposal pick one theme: a proposal arguing
 * for later buses and a new footbridge lands under transit, and the footbridge
 * leaves the analysis. Grouping claims puts each argument where it belongs and
 * lets the proposal appear under both.
 *
 * The proposals behind a theme are derived from its claims rather than reported
 * separately, so a theme cannot name a proposal that none of its claims came
 * from — there is no second list to disagree with the first.
 *
 * Every index the model returns is resolved against the claim list and dropped
 * if it is not there, so a theme cannot reach a facilitator carrying a claim
 * nobody made. A theme whose claims all fail that check is kept, with nothing
 * under it: the model found something, and silently deleting the finding would
 * hide that its grounding did not survive.
 *
 * @param claims - The numbered claims to group, from {@link extractClaims}.
 * @returns The themes, with claim indexes resolved to claims and the distinct
 *   proposals behind them.
 * @throws ThemeAnalysisFailure when the model's reply is unusable, or there are
 *   no claims to group. See {@link askForJson}.
 */
export const analyzeThemes = async (
  claims: ThemeAnalysisClaim[],
): Promise<ThemeAnalysisTheme[]> => {
  assertClaimsArePresent(claims, 'proposal-themes');

  const reply = await askForJson({
    name: 'proposal-themes',
    instructions: INSTRUCTIONS,
    prompt: `Group these ${claims.length} claims into themes.\n\n${renderClaimsForPrompt(claims)}`,
    schema: themesPassReplySchema,
  });

  return reply.themes.map(({ title, summary, claimIndexes }) => {
    const grouped = resolveClaimIndexes(claimIndexes, claims);

    return {
      title,
      summary,
      claims: grouped,
      proposals: proposalsBehindClaims(grouped),
    };
  });
};
