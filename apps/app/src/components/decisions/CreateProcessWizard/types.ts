import type { TranslationKey } from '@/lib/i18n';

/**
 * A key inside `decisions.createWizard`, relative to the namespace the wizard's
 * components scope `useTranslations` to. Derived from the dictionary, so a copy
 * table naming a key that does not exist fails `typecheck`.
 */
type StripNamespace<T> = T extends `decisions.createWizard.${infer K}`
  ? K
  : never;

export type WizardCopyKey = StripNamespace<TranslationKey>;

/**
 * The create-process wizard's content model.
 *
 * Copy lives here as `WizardCopyKey`s rather than literal strings, so the
 * dictionary is checked at compile time: a piece that names a key missing from
 * `en.json` fails `typecheck` instead of rendering the key at runtime.
 */

/** What a user can say they are running. */
export type ProcessType = 'grant' | 'pb' | 'other';

/** How applications arrive in a grantmaking process. */
export type GrantShape = 'single' | 'loi';

/** What people submit first in a participatory budgeting process. */
export type PbShape = 'ideas' | 'proposals';

/**
 * `custom` is the free-described "other" path, which composes its own mapping.
 * `blank` is the escape hatch: no phases, named and stewarded and nothing else.
 */
export type OtherShape = 'custom' | 'blank';

/** The shape follow-up answer, for whichever type was picked. */
export type ShapeKey = GrantShape | PbShape | OtherShape;

/** The underlying phase categories a piece can belong to. */
export type PhaseType =
  | 'submissions'
  | 'review'
  | 'develop'
  | 'voting'
  | 'results';

/**
 * One piece of Common's functionality for running this *kind* of process — not
 * a claim about the exact sequence of the user's real-world process.
 */
export interface ProcessPiece {
  /**
   * How the piece is pitched to the admin choosing it, e.g. 'screenIdeas'.
   * This is sales copy for a capability, read once, in a list of alternatives.
   */
  name: WizardCopyKey;
  /**
   * What the phase is called once it exists, e.g. 'reviewIdeas' — read by
   * participants on the timeline, every time, alongside the other phases. The
   * pitch and the label are different jobs; falls back to `name`.
   */
  phaseName?: WizardCopyKey;
  phaseType: PhaseType;
  /** One line, only where it adds something beyond the name. */
  description?: WizardCopyKey;
  /** The "You can" list — short verb-phrases. */
  capabilities: WizardCopyKey[];
  /** Optional "most people do X" nudge. */
  norm?: WizardCopyKey;
}

/** Everything the wizard collects, handed over when it finishes. */
export interface ProcessDraft {
  type: ProcessType;
  shape: ShapeKey;
  name: string;
  /** Which of the admin's identities fronts the process. */
  stewardProfileId: string;
  /** The resolved phase mapping — from the shape, or the "other" assessment. */
  pieces: ProcessPiece[];
}

/** One selectable option, as rendered by `ChoiceList` / `CheckList`. */
export interface Choice<K extends string> {
  key: K;
  label: WizardCopyKey;
  description?: WizardCopyKey;
}
