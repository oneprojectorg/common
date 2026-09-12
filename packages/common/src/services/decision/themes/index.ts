// Only what crosses this directory's boundary. Prompt rendering, corpus
// grounding, and the model-id resolver are internals of the two passes — the
// decision barrel re-exports this file wholesale, so anything named here becomes
// `@op/common` public API and acquires a compatibility obligation it never asked
// for.
export {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  THEME_ANALYSIS_MIN_PROPOSALS,
  THEME_ANALYSIS_PASS_TIMEOUT_MS,
  THEME_ANALYSIS_SNAPSHOT_TTL_SECONDS,
  themeAnalysisCacheKey,
  themeAnalysisResultCacheKey,
  themeAnalysisSnapshotCacheKey,
} from './constants';
export { fingerprintCorpus } from './corpusFingerprint';
export {
  readCachedThemeAnalysisResult,
  storeCachedThemeAnalysisResult,
} from './resultCache';
export {
  readLatestThemeAnalysis,
  storeLatestThemeAnalysis,
  type SnapshotRead,
} from './snapshotStore';
export { notifyProposalCorpusChanged } from './notifyProposalCorpusChanged';
export type { CorpusProposal } from './corpusGrounding';
export {
  collectProposalCorpus,
  readProposalsInScope,
  type CorpusReader,
  type ProposalCorpus,
} from './collectProposalCorpus';
export {
  ThemeAnalysisFailure,
  resolveThemeAnalysisErrorCode,
} from './ThemeAnalysisFailure';
export { analyzeThemes } from './analyzeThemes';
export {
  readCorpusForAnalysis,
  runCommonGroundPass,
  runThemesPass,
  type PassFailure,
} from './runPasses';
export {
  findCommonGround,
  type CommonGroundAnalysis,
} from './findCommonGround';
