import { z } from 'zod';

/**
 * Which proposals an analysis covers.
 *
 * `phase` is the instance's current phase — the set the proposals list shows,
 * and what a facilitator running this mid-process means. `process` is every
 * proposal the instance has ever held, including those rejected or dropped in an
 * earlier phase, which is what the results screen shows and what "what did
 * people propose" asks at the end.
 *
 * The two genuinely differ once an instance advances: a phase holds what
 * transitioned into it. Launching an analysis from a surface showing one set
 * while it reads the other would report a synthesis of proposals the reader is
 * not looking at, and the coverage line would not give it away.
 */
export const themeAnalysisScopeSchema = z.enum(['phase', 'process']);

export type ThemeAnalysisScope = z.infer<typeof themeAnalysisScopeSchema>;

/**
 * How far a proposal sits from the rest of the field.
 *
 * `high-impact` is an outlier the process should look at: it proposes something
 * substantial that nothing else proposes, so ignoring it loses the idea.
 * `low-impact` is an outlier that is merely unlike its neighbours — narrow,
 * minor, or off to one side — and the distinction is the point of asking. A
 * facilitator reading one list of "outliers" cannot tell the proposal worth a
 * conversation from the one worth a line in the notes.
 */
export const themeAnalysisOutlierImpactSchema = z.enum([
  'high-impact',
  'low-impact',
]);

export type ThemeAnalysisOutlierImpact = z.infer<
  typeof themeAnalysisOutlierImpactSchema
>;

/**
 * What a suggestion asks someone to do.
 *
 * `merge` names two or more proposals that say close enough to the same thing
 * to become one. `modify` names a single proposal and a small change that would
 * bring it inside the common ground. Both are advisory: nothing in this pipeline
 * writes to a proposal, and the existing merge flow is where a merge actually
 * happens.
 */
export const themeAnalysisSuggestionKindSchema = z.enum(['merge', 'modify']);

export type ThemeAnalysisSuggestionKind = z.infer<
  typeof themeAnalysisSuggestionKindSchema
>;

/**
 * Bounds on model-written prose, applied where the reply is parsed.
 *
 * These strings go into a dialog with a fixed layout, and into a `jsonb` column
 * nobody wants to grow without a bound. The caps are generous enough that a
 * well-behaved reply never meets them.
 *
 * They truncate rather than reject. A model that ignores "one sentence" and
 * returns four paragraphs has not failed — and rejecting would throw away the
 * whole analysis, including the themes pass that already succeeded and was
 * already paid for, over one long rationale. `.min(1)` still rejects, because an
 * empty required field is a malfunction rather than a verbose answer.
 */
const LABEL_MAX = 200;
const PROSE_MAX = 1_000;

const clampTo = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, max));

const label = clampTo(LABEL_MAX);
const prose = clampTo(PROSE_MAX);

/**
 * How many items each section of an analysis may hold.
 *
 * The prompts ask for fewer than these. They are here to bound what gets stored
 * and rendered when a reply ignores the ask, not to express the ask — so, like
 * the prose caps, they drop the excess rather than failing the run. Thirteen
 * themes against a ceiling of twelve is a reply worth keeping twelve of.
 */
const MAX_THEMES = 12;
const MAX_COMMON_GROUND = 10;
const MAX_OUTLIERS = 20;
const MAX_SUGGESTIONS = 15;

/**
 * A proposal's position in the corpus the model was shown, one-based.
 *
 * The model never sees a proposal id. It is given a numbered list and answers in
 * those numbers, and the service maps them back. That is what makes a
 * hallucinated reference detectable: an index outside the corpus is out of
 * range, where an invented UUID is indistinguishable from a real one until
 * something tries to load it.
 *
 * Positive and integral is checked here; in-range is checked against the actual
 * corpus, which this schema does not know about.
 */
const corpusIndex = z.number().int().positive();

/**
 * Zod schema for what the themes pass is asked to return.
 *
 * The pass reads the corpus and names what it is about. Each theme carries the
 * proposals that carry it, so the facilitator can go from a theme back to the
 * text — a theme with no proposals behind it is an assertion, not a finding.
 */
export const themesPassReplySchema = z.object({
  themes: z
    .array(
      z.object({
        title: label,
        summary: prose,
        proposalIndexes: z.array(corpusIndex),
      }),
    )
    .transform((themes) => themes.slice(0, MAX_THEMES)),
});

export type ThemesPassReply = z.infer<typeof themesPassReplySchema>;

/**
 * Zod schema for what the common-ground pass is asked to return.
 *
 * This is the pass the task calls the Habermas machine. It reads the themes and
 * the corpus together and answers three questions a list of themes cannot: what
 * do these proposals already agree on, who is standing outside that agreement
 * and does it matter, and what small move would bring them closer.
 */
export const commonGroundPassReplySchema = z.object({
  commonGround: z
    .array(
      z.object({
        statement: prose,
        proposalIndexes: z.array(corpusIndex),
      }),
    )
    .transform((entries) => entries.slice(0, MAX_COMMON_GROUND)),
  outliers: z
    .array(
      z.object({
        proposalIndex: corpusIndex,
        impact: themeAnalysisOutlierImpactSchema,
        reason: prose,
      }),
    )
    .transform((entries) => entries.slice(0, MAX_OUTLIERS)),
  suggestions: z
    .array(
      z.object({
        kind: themeAnalysisSuggestionKindSchema,
        rationale: prose,
        proposalIndexes: z.array(corpusIndex),
      }),
    )
    .transform((entries) => entries.slice(0, MAX_SUGGESTIONS)),
});

export type CommonGroundPassReply = z.infer<typeof commonGroundPassReplySchema>;

/**
 * A proposal named by an analysis, carrying the title the reader will recognise.
 *
 * The title travels with the reference rather than being looked up when the
 * dialog renders. The record is a snapshot of a corpus at a moment, so a
 * proposal retitled or deleted afterwards should still read as what the analysis
 * actually looked at, and the dialog should not need a second query to show a
 * name.
 */
const analyzedProposalSchema = z.object({
  id: z.string(),
  title: z.string(),
});

/**
 * Zod schema for one theme, as stored and served.
 *
 * The corpus indexes of {@link themesPassReplySchema} are resolved to real
 * proposals here. Anything the model named that was not in the corpus is gone by
 * this point, so a reader of this record cannot be shown a proposal that was
 * never analysed.
 */
export const themeAnalysisThemeSchema = z.object({
  title: z.string(),
  summary: z.string(),
  proposals: z.array(analyzedProposalSchema),
});

export type ThemeAnalysisTheme = z.infer<typeof themeAnalysisThemeSchema>;

/** Zod schema for one area of common ground, as stored and served. */
export const themeAnalysisCommonGroundSchema = z.object({
  statement: z.string(),
  proposals: z.array(analyzedProposalSchema),
});

export type ThemeAnalysisCommonGround = z.infer<
  typeof themeAnalysisCommonGroundSchema
>;

/** Zod schema for one outlier, as stored and served. */
export const themeAnalysisOutlierSchema = z.object({
  proposal: analyzedProposalSchema,
  impact: themeAnalysisOutlierImpactSchema,
  reason: z.string(),
});

export type ThemeAnalysisOutlier = z.infer<typeof themeAnalysisOutlierSchema>;

/** Zod schema for one suggestion, as stored and served. */
export const themeAnalysisSuggestionSchema = z.object({
  kind: themeAnalysisSuggestionKindSchema,
  rationale: z.string(),
  proposals: z.array(analyzedProposalSchema),
});

export type ThemeAnalysisSuggestion = z.infer<
  typeof themeAnalysisSuggestionSchema
>;

/**
 * Zod schema for the finished analysis: both passes, grounded and merged.
 *
 * Written to the record in one update when the run completes, so a reader that
 * sees `status: 'completed'` sees all four sections or none.
 */
export const themeAnalysisResultSchema = z.object({
  themes: z.array(themeAnalysisThemeSchema),
  commonGround: z.array(themeAnalysisCommonGroundSchema),
  outliers: z.array(themeAnalysisOutlierSchema),
  suggestions: z.array(themeAnalysisSuggestionSchema),
});

export type ThemeAnalysisResult = z.infer<typeof themeAnalysisResultSchema>;

/**
 * Why an analysis failed, as something the app can translate.
 *
 * The record's `errorMessage` is composed in `@op/common`, which has no
 * `useTranslations` — so putting it in a toast shows English to every reader
 * whatever their locale. The code travels instead, the app maps it to `t()`
 * copy, and the message stays for the log.
 *
 * `.catch('unknown')` so a code written by a newer deploy, or a record from
 * before this existed, still parses and still reports a failure.
 */
export const themeAnalysisErrorCodeSchema = z
  .enum(['not-enough-text', 'analysis-unusable', 'unknown'])
  .catch('unknown');

export type ThemeAnalysisErrorCode = z.infer<
  typeof themeAnalysisErrorCodeSchema
>;

/**
 * Zod object schema for one stored theme analysis.
 *
 * The cache holds the only copy. Nothing stands behind it, so this schema is the
 * sole description of the shape and the sole check on it:
 * `getThemeAnalysisStatus` parses every read against it and reports a record
 * that fails as `not_found`, which returns the client to idle rather than
 * leaving it waiting on something no later read repairs.
 *
 * `requestThemeAnalysis` seeds the record in full and the workflow overwrites it
 * whole, so a record that fails this check is one an eviction interrupted — and
 * the seed read-back in the request is what stops a deployment with no cache
 * from producing them by the dozen.
 */
export const themeAnalysisRecordSchema = z.object({
  analysisId: z.string(),
  processInstanceId: z.string(),
  userId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  createdAt: z.string(),
  completedAt: z.string().optional(),
  /** Diagnostic detail. Logged, never rendered — see {@link themeAnalysisErrorCodeSchema}. */
  errorMessage: z.string().optional(),
  /** What the app renders for a failure. Absent on a run that has not failed. */
  errorCode: themeAnalysisErrorCodeSchema.optional(),
  result: themeAnalysisResultSchema.optional(),
  /** Proposals the analysis actually read. Set once it completes. */
  analyzedCount: z.number().optional(),
  /**
   * Proposals the phase held when the read started. Set once it completes.
   *
   * Carried beside `analyzedCount` on every completed run rather than only on
   * short ones, so the dialog states the coverage instead of leaving the reader
   * to assume it. An analysis that silently covered a quarter of the field
   * still reads as a statement about the whole process.
   */
  total: z.number().optional(),
});

export type ThemeAnalysisData = z.infer<typeof themeAnalysisRecordSchema>;

/**
 * Zod union schema for everything `getThemeAnalysisStatus` answers: one parsed
 * record, or the not-found arm.
 *
 * The tRPC procedure uses this as its `.output()` schema, so one definition
 * describes both the service return type and the wire contract.
 *
 * `status` discriminates the two arms. `'not_found'` is not a member of
 * {@link themeAnalysisRecordSchema}'s `status` enum, so a caller that matches a
 * record status narrows the not-found arm away with no further check.
 */
export const themeAnalysisResponseSchema = z.union([
  z.object({ status: z.literal('not_found') }),
  themeAnalysisRecordSchema,
]);

export type ThemeAnalysisResponse = z.infer<typeof themeAnalysisResponseSchema>;
