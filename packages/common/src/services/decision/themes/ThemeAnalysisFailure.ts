import { CommonError } from '../../../utils';
import type { ThemeAnalysisErrorCode } from '../schemas/themeAnalysis';

/**
 * A theme analysis failure that names why, in a form the app can translate.
 *
 * The message stays English and diagnostic — it names the pass, the counts, the
 * shape that did not match — because it goes to the log and to the record's
 * `errorMessage`, both of which are read by whoever is debugging. The `code` is
 * what reaches the facilitator, through `t()` copy the app picks.
 *
 * Extends `CommonError` so it travels the same path every other service error
 * does, and so a caller that only knows about `CommonError` still catches it.
 *
 * @param code - What to tell the facilitator. See `themeAnalysisErrorCodeSchema`.
 * @param message - Diagnostic detail. Logged and recorded, never rendered.
 */
export class ThemeAnalysisFailure extends CommonError {
  readonly code: ThemeAnalysisErrorCode;

  constructor(code: ThemeAnalysisErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'ThemeAnalysisFailure';
  }
}

/**
 * The code a caught failure carries, or `'unknown'` for anything else.
 *
 * `unknown` is the honest answer for a failure nobody anticipated: the app has
 * copy for it, and the message is in the record and the log for whoever looks.
 *
 * @param error - Whatever was thrown. Typed `unknown` because a caught value
 *   carries no guarantee.
 * @returns The failure's code.
 */
export const resolveThemeAnalysisErrorCode = (
  error: unknown,
): ThemeAnalysisErrorCode =>
  error instanceof ThemeAnalysisFailure ? error.code : 'unknown';
