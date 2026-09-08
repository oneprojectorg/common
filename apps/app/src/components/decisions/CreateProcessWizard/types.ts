import type { TranslationKey } from '@/lib/i18n';

/**
 * The create-process wizard's content model.
 *
 * Copy lives here as `TranslationKey`s rather than literal strings, so the
 * dictionary is checked at compile time: a piece that names a key missing from
 * `en.json` fails `typecheck` instead of rendering the key at runtime.
 */

/** What a user can say they are running. */
export type ProcessType = 'grant' | 'pb' | 'other';

/** The shape follow-up answer. `custom` is the free-described "other" path. */
export type ShapeKey = 'single' | 'loi' | 'ideas' | 'proposals' | 'custom';

/** The underlying phase categories a piece can belong to. */
export type PhaseType =
  | 'submissions'
  | 'review'
  | 'develop'
  | 'voting'
  | 'results';

/** Who can take part, as asked in the last step. */
export type Audience = 'anyone' | 'invite';

/**
 * One piece of Common's functionality for running this *kind* of process — not
 * a claim about the exact sequence of the user's real-world process.
 */
export interface ProcessPiece {
  /**
   * How the piece is pitched to the admin choosing it, e.g. "Screen the ideas".
   * This is sales copy for a capability, read once, in a list of alternatives.
   */
  name: TranslationKey;
  /**
   * What the phase is called once it exists, e.g. "Review the ideas" — read by
   * participants on the timeline, every time, alongside the other phases. The
   * pitch and the label are different jobs; falls back to `name`.
   */
  phaseName?: TranslationKey;
  phaseType: PhaseType;
  /** One line, only where it adds something beyond the name. */
  description?: TranslationKey;
  /** The "You can" list — short verb-phrases. */
  capabilities: TranslationKey[];
  /** Optional "most people do X" nudge. */
  norm?: TranslationKey;
}

/** Everything the wizard collects, handed over when it finishes. */
export interface ProcessDraft {
  type: ProcessType;
  shape: ShapeKey;
  name: string;
  audience: Audience;
  submissionsPrivate: boolean;
  /** The resolved phase mapping — from the shape, or the "other" assessment. */
  pieces: ProcessPiece[];
}

/** One selectable option, as rendered by `ChoiceList` / `CheckList`. */
export interface Choice<K extends string> {
  key: K;
  label: TranslationKey;
  description?: TranslationKey;
}
