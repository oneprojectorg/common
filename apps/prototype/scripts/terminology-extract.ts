import {
  PHASE_TYPE_LABEL,
  SHAPE_QUESTION,
  TYPE_META,
  TYPE_ORDER,
  piecesFor,
} from '../src/components/decisions/CreateProcessWizard/content';
import {
  CADENCE_OPTIONS,
  DECISION_OPTIONS,
  EMPTY_OTHER,
  SUBJECT_OPTIONS,
  SUBMIT_HEADING,
  SUBMIT_OPTIONS,
  composeOtherPieces,
} from '../src/components/decisions/CreateProcessWizard/otherFlow';
import type {
  PhaseType,
  ProcessType,
} from '../src/components/decisions/CreateProcessWizard/types';
/**
 * PROTOTYPE ONLY — throwaway extractor.
 *
 * Dumps every string that varies by process type, by *calling* the real
 * `vocabulary()` / `phaseCopy()` rather than re-describing them, so the
 * terminology sheet cannot disagree with what the prototype renders.
 */
import {
  DONE_LABEL,
  INVITEE_LABEL,
  phaseCopy,
  vocabulary,
  voteMethodMeta,
} from '../src/components/prototype/store';

const PHASES: PhaseType[] = [
  'submissions',
  'review',
  'develop',
  'voting',
  'results',
];

/** Enough of a process for the copy functions; they read type + phase types. */
const proc = (type: ProcessType, phaseTypes: PhaseType[]) =>
  ({ type, phases: phaseTypes.map((phaseType) => ({ phaseType })) }) as never;

/* `pb` forks again on whether a develop phase exists: with one, the first round
   collects rough "ideas"; without, what arrives is already the proposal. Both
   columns matter, so both are extracted. */
const COLUMNS = [
  { key: 'grant', label: 'Grantmaking', process: proc('grant', PHASES) },
  {
    key: 'pb_develop',
    label: 'Participatory budgeting (with a Develop phase)',
    process: proc('pb', PHASES),
  },
  {
    key: 'pb_plain',
    label: 'Participatory budgeting (no Develop phase)',
    process: proc('pb', ['submissions', 'review', 'voting', 'results']),
  },
  { key: 'other', label: 'Generic / Other', process: proc('other', PHASES) },
];

const out = {
  columns: COLUMNS.map(({ key, label }) => ({ key, label })),
  processTypes: TYPE_ORDER.map((t) => ({
    type: t,
    label: TYPE_META[t].label,
    subjectPhrase: TYPE_META[t].subjectPhrase,
    description: TYPE_META[t].description,
  })),
  phaseTypeLabels: PHASE_TYPE_LABEL,
  inviteeLabel: INVITEE_LABEL,
  doneLabel: DONE_LABEL,
  nouns: COLUMNS.map(({ key, process }) => ({
    column: key,
    overall: vocabulary(process),
    perPhase: Object.fromEntries(
      PHASES.map((p) => [p, vocabulary(process, p)]),
    ),
  })),
  phaseCopy: COLUMNS.map(({ key, process }) => ({
    column: key,
    phases: Object.fromEntries(PHASES.map((p) => [p, phaseCopy(process, p)])),
  })),
  voteMethods: COLUMNS.map(({ key, process }) => ({
    column: key,
    methods: voteMethodMeta(process),
  })),
  shapes: TYPE_ORDER.map((t) => ({
    type: t,
    question: SHAPE_QUESTION[t]?.heading ?? null,
    options: SHAPE_QUESTION[t]?.options ?? [],
  })),
  pieces: TYPE_ORDER.flatMap((t) =>
    (SHAPE_QUESTION[t]?.options ?? [{ key: 'custom' }]).map((opt) => ({
      type: t,
      shape: opt.key,
      pieces: piecesFor(t, opt.key as never).map((p) => ({
        name: p.name,
        phaseName: p.phaseName ?? null,
        phaseType: p.phaseType,
        description: p.description ?? null,
        capabilities: p.capabilities,
        norm: p.norm ?? null,
      })),
    })),
  ),
};

/* The generic path has no fixed phase set — it composes one from the four
   answers. Capturing the option copy plus one representative composition per
   subject shows the naming without enumerating the whole product. */
const otherFlow = {
  subjectOptions: SUBJECT_OPTIONS,
  cadenceOptions: CADENCE_OPTIONS,
  submitHeadings: SUBMIT_HEADING,
  submitOptions: SUBMIT_OPTIONS,
  decisionOptions: DECISION_OPTIONS,
  sampleCompositions: SUBJECT_OPTIONS.map((subject) => {
    const submit = SUBMIT_OPTIONS[subject.key]?.[0]?.key ?? null;
    const answers = {
      ...EMPTY_OTHER,
      subject: subject.key,
      cadence: 'timeline',
      submit,
      decision: 'review',
    } as never;

    return {
      subject: subject.key,
      submit,
      decision: 'review',
      pieces: composeOtherPieces(answers).map((p) => ({
        name: p.name,
        phaseName: p.phaseName ?? null,
        phaseType: p.phaseType,
        description: p.description ?? null,
        capabilities: p.capabilities,
        norm: p.norm ?? null,
      })),
    };
  }),
};

console.log(JSON.stringify({ ...out, otherFlow }, null, 2));
