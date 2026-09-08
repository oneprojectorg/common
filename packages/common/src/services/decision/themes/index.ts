// Only what crosses this directory's boundary. Prompt rendering, corpus
// grounding, and the model-id resolver are internals of the two passes — the
// decision barrel re-exports this file wholesale, so anything named here becomes
// `@op/common` public API and acquires a compatibility obligation it never asked
// for.
export {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  THEME_ANALYSIS_MIN_PROPOSALS,
  themeAnalysisCacheKey,
} from './constants';
export type { CorpusProposal } from './corpusGrounding';
export {
  collectProposalCorpus,
  readProposalsInScope,
  type ProposalCorpus,
} from './collectProposalCorpus';
export {
  ThemeAnalysisFailure,
  resolveThemeAnalysisErrorCode,
} from './ThemeAnalysisFailure';
export { analyzeThemes } from './analyzeThemes';
export {
  runCommonGroundPass,
  runThemesPass,
  type PassFailure,
} from './runPasses';
export {
  findCommonGround,
  type CommonGroundAnalysis,
} from './findCommonGround';
