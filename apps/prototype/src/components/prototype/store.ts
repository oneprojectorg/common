'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IconType } from 'react-icons';
import { LuGlobe, LuLink } from 'react-icons/lu';

import type {
  Audience,
  PhaseType,
  ProcessDraft,
  ProcessType,
} from '@/components/decisions/CreateProcessWizard/types';

import { PROTOTYPE_USER } from './fakeUser';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Stands in for the API: a process the wizard creates, and everything later
 * edited on its page and phase pages, is kept in localStorage so the whole flow
 * can be walked with no database. One seeded process is always present, already
 * running, so the decisions list isn't empty on a first visit.
 */

export const NAME_LIMIT = 50;

export const ANSWER_FORMATS = [
  'Text',
  'Amount',
  'Multiple choice',
  'Location',
  'File',
] as const;
export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

/**
 * Formats that have been renamed or merged. Short versus long text was never a
 * decision worth making at setup time — the answer is text either way — and
 * "Choice" didn't say that a set of answers comes with it.
 */
const RENAMED_FORMATS: Record<string, AnswerFormat> = {
  'Short text': 'Text',
  'Long text': 'Text',
  Choice: 'Multiple choice',
};

/**
 * The currencies an amount can be asked in — the same set, in the same order, as
 * the product's own budget field. Names are not listed: `Intl.DisplayNames`
 * knows them in the reader's language, and a hand-written English list would be
 * the one part of this form that never translated.
 */
export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '\u20ac' },
  { code: 'GBP', symbol: '\u00a3' },
  { code: 'JPY', symbol: '\u00a5' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'CNY', symbol: '\u00a5' },
  { code: 'INR', symbol: '\u20b9' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'KRW', symbol: '\u20a9' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'AED', symbol: '\u062f.\u0625' },
  { code: 'SAR', symbol: '\ufdfc' },
] as const;

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_SYMBOLS = new Map<string, string>(
  CURRENCIES.map((currency) => [currency.code, currency.symbol]),
);

export const LOCATION_MODES = ['anywhere', 'areas', 'file'] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export const LOCATION_MODE_META: Record<
  LocationMode,
  { title: string; helper: string }
> = {
  anywhere: {
    title: 'Anywhere',
    helper: 'Any place on the map is a valid answer.',
  },
  areas: {
    title: 'Within listed areas',
    helper: 'Postcodes or zip codes an answer has to fall inside.',
  },
  file: {
    title: 'Within an uploaded boundary',
    helper: 'A coordinate file, for a line no postcode follows.',
  },
};

/** Where a Location answer is allowed to be. */
export interface LocationBounds {
  mode: LocationMode;
  /** Postcodes or zip codes, when `mode` is `areas`. */
  areas: string[];
  /** The uploaded coordinate file, when `mode` is `file`. A stub here. */
  fileName?: string;
}

export const RATING_MAXIMUMS = [3, 5, 7, 10] as const;

/**
 * A rating means nothing without saying what its ends mean — "3 out of 5" is
 * not a judgement until someone writes down what 1 and 5 are.
 */
export interface RatingScale {
  max: number;
  lowLabel?: string;
  highLabel?: string;
}

/** The scales a criterion can be scored on — what the add menu offers. */
export const RUBRIC_SCALES = ['Rating scale', 'Yes / No', 'Text'] as const;

/**
 * The recommendation's stored scale. Kept out of `RUBRIC_SCALES` because it is
 * not a scale anyone can pick: it comes with the row and it never changes.
 */
export const RECOMMENDATION_SCALE = 'Recommendation';

export type RubricScale =
  | (typeof RUBRIC_SCALES)[number]
  | typeof RECOMMENDATION_SCALE;

export const VOTE_METHODS = ['simple', 'knapsack', 'rank'] as const;
export type VoteMethod = (typeof VOTE_METHODS)[number];

/**
 * One vote per phase, so the three methods are exclusive. They used to be a
 * list you could combine, and stored phases still carry the old names.
 */
export const RENAMED_VOTE_METHODS: Record<string, VoteMethod> = {
  pick: 'simple',
  spread: 'knapsack',
};

export interface FormField {
  id: string;
  label: string;
  description?: string;
  format: AnswerFormat;
  /** Default off — a field is required unless this says otherwise. */
  optional: boolean;
  /** Carried over from an earlier Submissions form: shown, pinned, not editable. */
  locked?: boolean;
  /**
   * The answers to pick from, when `format` is `Multiple choice`. These are also
   * what a Review phase can split its pile by, so a choice question with no
   * options is worth nothing to anyone.
   */
  options?: string[];
  /** Where the answer may be, when `format` is `Location`. */
  bounds?: LocationBounds;
  /**
   * What the amount is in, when `format` is `Amount` — an ISO 4217 code, the
   * same shape the product's own money values carry. The currency is the
   * question's, not the answer's: a form that let every proposal pick its own
   * could not add its answers up.
   */
  currency?: string;
  /** The most that may be asked for, when `format` is `Amount`. Optional. */
  maxAmount?: number;
  /**
   * More than one answer may be picked, when `format` is `Multiple choice`. A
   * grouping dimension still reads the same options — a proposal in two groups
   * is a grouping question, not a broken one.
   */
  allowsMultiple?: boolean;
  /**
   * The answer is not shown alongside the proposal: admins and reviewers see
   * it, nobody else does. For the questions a process has to ask but shouldn't
   * publish — a contact number, an access need, a bank detail.
   */
  isConfidential?: boolean;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description?: string;
  scale: RubricScale;
  optional: boolean;
  /** How far the scale runs and what its ends mean, when `scale` is a rating. */
  rating?: RatingScale;
  /**
   * The reviewer's overall call rather than one of the things being scored.
   * Pinned to the end of the rubric, and only ever one of them.
   */
  isRecommendation?: boolean;
}

export const DEFAULT_RATING: RatingScale = { max: 5 };

/** What the recommendation criterion is called before anyone renames it. */
export const RECOMMENDATION_LABEL = 'Overall recommendation';

/**
 * The recommendation's own answers, which is why it isn't one of the scales
 * above: the same three-way call from every reviewer is the whole point of it,
 * so there is nothing here for an admin to configure.
 */
export const RECOMMENDATION_ANSWERS = ['Yes', 'Maybe', 'No'] as const;

/** Stated on the card. Built from the answers, so the two can't drift apart. */
export const RECOMMENDATION_HINT = `Reviewers will select from ${RECOMMENDATION_ANSWERS.slice(
  0,
  -1,
).join(', ')}, or ${RECOMMENDATION_ANSWERS[RECOMMENDATION_ANSWERS.length - 1]}`;

/** Two blank answers: a choice of one is not a choice, and of none is a bug. */
export const DEFAULT_CHOICES = ['', ''];

export const DEFAULT_BOUNDS: LocationBounds = { mode: 'anywhere', areas: [] };

export type InviteeStatus = 'invited' | 'joined' | 'done';

export interface Invitee {
  id: string;
  email: string;
  status: InviteeStatus;
  /** When the current status was reached, as an epoch so it survives JSON. */
  at: number;
  /**
   * Which slice of the pile this person reviews — one of the options of the
   * question the phase groups by. Only meaningful while the phase distributes
   * `by focus area`; kept when the mode changes so switching back doesn't lose
   * the assignments.
   */
  focusArea?: string;
}

/* Render order in the chooser. `open` leads because it is the default and needs
   no setup; `group` is last because it is the only one with a screen behind it. */
export const ASSIGNMENT_MODES = ['open', 'evenly', 'manual', 'group'] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export interface Assignment {
  mode: AssignmentMode;
  /**
   * Which submission question the pile is categorised along, when `mode` is
   * `group`. An array because that is what every reader of it expects, but the
   * picker is single-select — one question's answers are the categories.
   */
  groupByFieldIds?: string[];
}

/** The chooser's copy — one line each, in the same voice and the same noun. */
export function assignmentMeta(
  process: PrototypeProcess,
): Record<AssignmentMode, { title: string; helper: string }> {
  const { one, many } = vocabulary(process, 'review');

  return {
    open: {
      title: 'Open to all',
      helper: `Any reviewer can review any ${one}`,
    },
    evenly: {
      title: 'Divide evenly',
      helper: `Assign ${many} evenly across reviewers`,
    },
    manual: {
      title: 'I will manually assign',
      helper: `You pick the reviewers for each ${one} yourself`,
    },
    group: {
      title: `By ${one} category`,
      helper: `Assign ${many} to reviewers by category`,
    },
  };
}

export interface PrototypePhase {
  id: string;
  name: string;
  phaseType: PhaseType;
  startDate?: string;
  endDate?: string;
  /** Submissions and Develop use fields; Review uses criteria. */
  fields: FormField[];
  criteria: RubricCriterion[];
  audience: Audience;
  invitees: Invitee[];
  toggles: Record<string, boolean>;
  /** Voting only. How people vote — one method, not a combination. */
  voteMethod: VoteMethod;
  /**
   * Voting only. Whether a knapsack vote also asks for an order within the
   * bundle: which of the projects I chose matter most, if not all of them fit.
   */
  rankBundle?: boolean;
  /**
   * Review only. How proposals reach reviewers. Optional because stored phases
   * predate it, and absent reads as the default: open to all.
   */
  assignment?: Assignment;
  /** Voting only. What a knapsack vote has to fit inside. */
  budget: string;
  /** Voting only. How many votes each person gets — simple and stack rank. */
  pickCount: string;
  resultsDisplay: 'titles' | 'full';
  /** Set by leaving the phase page — there is no Save. */
  configured: boolean;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  /** When it was pinned, as an epoch so it survives JSON. */
  addedAt?: number;
}

/** Who can find the process page. */
export type Visibility = 'listed' | 'unlisted';

/**
 * The two answers, each with its own sentence. Shared by `Settings` and the
 * launch dialog: it is one field asked in two places, and two wordings of the
 * same choice is two choices as far as anyone reading them is concerned.
 */
export const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  /* The shape of the answer before the words are read: one is out in the open,
     the other only reachable through a link somebody sent you. */
  icon: IconType;
}[] = [
  {
    value: 'listed',
    label: 'Public',
    description: "Listed and searchable in Common's processes.",
    icon: LuGlobe,
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    description: "Only reachable by people it's shared with.",
    icon: LuLink,
  },
];

export interface ProcessAdmin {
  id: string;
  /** Empty until they accept — an outstanding invitation has only an email. */
  name: string;
  email: string;
  /** Whoever is looking at the page. Can't be removed by themselves. */
  isYou?: boolean;
}

/** The admin who set the process up, when none were ever stored. */
export const FOUNDING_ADMIN: ProcessAdmin = {
  id: 'you',
  name: PROTOTYPE_USER.name,
  email: PROTOTYPE_USER.email,
  isYou: true,
};

/** The admins of a process, whether or not the record carries the field. */
export function processAdmins(process: PrototypeProcess): ProcessAdmin[] {
  return process.admins ?? [FOUNDING_ADMIN];
}

export interface PrototypeProcess {
  id: string;
  name: string;
  summary?: string;
  steward: string;
  /**
   * Kept from the wizard because a rule depends on it: in participatory
   * budgeting a Develop phase leads with a fresh form, everywhere else it leads
   * with building on what was already submitted.
   *
   * Optional because processes stored before this field existed don't carry it,
   * and a prototype shouldn't pretend otherwise. Absent reads as "not PB",
   * which is the majority rule.
   */
  type?: ProcessType;
  audience: Audience;
  /**
   * Who can find the page, as opposed to `audience`, which is who can take
   * part. Optional for the same reason as `type`: older stored records predate
   * it, and absent reads as the default, `listed`.
   */
  visibility?: Visibility;
  /**
   * The hero banner, held as a data URL. Real bytes rather than a filename, so
   * the image survives a reload the way everything else here does — the trade is
   * that a large file eats the storage quota, so the modal caps the size.
   */
  banner?: string;
  /**
   * Everyone who can set up and run this process. Held on the process rather
   * than inside the dialog that edits it, because the header has to say whether
   * there is anyone here but you — `Add admin` and `Manage admins` are the same
   * button answering that question.
   *
   * Optional because records stored before this field existed don't carry it;
   * `processAdmins` fills in the one admin there must always have been.
   */
  admins?: ProcessAdmin[];
  /**
   * What the admins expect to happen, answered at launch: how many people take
   * part at all, and how much comes in. Not a cap on anything — it is what the
   * process is measured against afterwards, so it is asked once, at the moment
   * the answer is a prediction rather than a report.
   */
  targetParticipants?: number;
  targetSubmissions?: number;
  status: 'draft' | 'published';
  phases: PrototypePhase[];
  /**
   * The About body, as HTML from the rich text editor. One flat field rather
   * than a list of section kinds: the page has one thing to say about itself,
   * and the product renders it bare — no card, no heading.
   */
  about: string;
  resources: Resource[];
  /** Index of the phase currently running; -1 before the process starts. */
  currentPhaseIndex: number;
  isSeed?: boolean;
  /** Set when an admin takes a live process off the active list. */
  archivedAt?: number;
  proposalCount?: number;
  participantCount?: number;
}

const STORAGE_KEY = 'op-prototype-processes';

/**
 * Per-phase-type option toggles, and which start on. Copy is the prototype's:
 * these read as claims about what the product does, so they are content for
 * review rather than chrome.
 */
/**
 * Collecting phases — Submissions and Develop — ask the same two things: who
 * gets to see what came in, and whether an author can still change it.
 *
 * `privateSubmissions` is the inverse of the old "Show submissions to
 * everyone": the default is still a browsable pile, which is why it is off.
 */
export interface PhaseToggle {
  key: string;
  title: string;
  helper: string;
  on: boolean;
}

export function phaseToggles(
  process: PrototypeProcess,
  phaseType: PhaseType,
): PhaseToggle[] {
  const { one, many } = vocabulary(process, phaseType);

  // Collecting phases — Submissions and Develop — ask the same two things: who
  // gets to see what came in, and whether an author can still change it. A
  // Develop phase collects the way a Submissions phase does, so it asks the
  // same two questions rather than a paraphrase of them.
  if (phaseType === 'submissions' || phaseType === 'develop') {
    return [
      {
        // The inverse of the old "Show submissions to everyone": the default is
        // still a browsable pile, which is why it is off.
        key: 'privateSubmissions',
        title: `Private ${many}`,
        helper: 'Only organisers see what people send in.',
        on: false,
      },
      {
        key: 'editAfter',
        title: 'Edit after submitting',
        helper: 'Authors can revise until the phase closes.',
        on: true,
      },
    ];
  }

  if (phaseType === 'review') {
    return [
      {
        key: 'blind',
        title: 'Blind review',
        helper: "Reviewers can't see each other's scores.",
        on: true,
      },
      {
        key: 'requestRevisions',
        title: 'Revision requests',
        helper: `Reviewers can send ${
          /^[aeiou]/i.test(one) ? 'an' : 'a'
        } ${one} back for changes.`,
        on: false,
      },
    ];
  }

  // Nothing for voting or results. How people vote is the ballot's own setting,
  // and what a result shows belongs to the results body — neither was a rule
  // about the phase, which is what this box is for.
  return [];
}

/**
 * What the things people send in are called, in this process's own words.
 *
 * Grantmaking runs on applications. Participatory budgeting runs on proposals —
 * unless it starts with a rough round and builds them up later, in which case
 * the first round collects ideas and everything after it handles the proposals
 * they became. Anything else keeps the generic word.
 *
 * One noun per process, chosen once, so the wizard, the rail, the phase pages
 * and the participant view never disagree about what is being collected.
 */
export interface Vocabulary {
  /** "idea" / "proposal" / "application" / "submission" */
  one: string;
  many: string;
  /** Sentence-capitalised, for the start of a line or a heading. */
  One: string;
  Many: string;
}

const NOUNS: Record<string, Vocabulary> = {
  idea: { one: 'idea', many: 'ideas', One: 'Idea', Many: 'Ideas' },
  proposal: {
    one: 'proposal',
    many: 'proposals',
    One: 'Proposal',
    Many: 'Proposals',
  },
  application: {
    one: 'application',
    many: 'applications',
    One: 'Application',
    Many: 'Applications',
  },
  submission: {
    one: 'submission',
    many: 'submissions',
    One: 'Submission',
    Many: 'Submissions',
  },
};

export function vocabulary(
  process: PrototypeProcess,
  phaseType?: PhaseType,
): Vocabulary {
  if (process.type === 'grant') {
    return NOUNS.application!;
  }

  if (process.type === 'pb') {
    // A develop phase is what makes the first round rough: without one, what
    // arrives in the first round is already the proposal.
    const buildsThemUp = process.phases.some(
      (phase) => phase.phaseType === 'develop',
    );

    return buildsThemUp && phaseType === 'submissions'
      ? NOUNS.idea!
      : NOUNS.proposal!;
  }

  return NOUNS.submission!;
}

/**
 * People who already have a Common account, for the invite field to search.
 * Stands in for the directory the real thing queries: adding one of these puts
 * them straight on the list, where an address that matches nobody has to be
 * emailed an invitation first.
 */
export const COMMON_DIRECTORY: { name: string; email: string }[] = [
  { name: 'Marisol Ortega', email: 'marisol@eastside.org' },
  { name: 'Daniel Kim', email: 'daniel.kim@eastside.org' },
  { name: 'Aisha Bello', email: 'aisha@riverside-collective.org' },
  { name: 'Tom\u00e1s Rivera', email: 'tomas.rivera@eastside.org' },
  { name: 'Grace Lin', email: 'grace@northside-mutual.org' },
  { name: 'Omar Haddad', email: 'omar.haddad@eastside.org' },
  { name: 'Priya Raman', email: 'priya@downtown-alliance.org' },
  { name: 'Lena Novak', email: 'lena@eastside.org' },
  { name: 'Yusuf Demir', email: 'yusuf@riverside-collective.org' },
  { name: 'Bea Fontaine', email: 'bea@northside-mutual.org' },
];

/** What the people in a phase are called — tab name, CTA and access copy. */
export const INVITEE_LABEL: Record<PhaseType, string> = {
  submissions: 'Participants',
  review: 'Reviewers',
  develop: 'Participants',
  voting: 'Voters',
  results: 'Participants',
};

/** What "done" means in a phase. Results has no act to finish. */
export const DONE_LABEL: Record<PhaseType, string | null> = {
  submissions: 'Submitted',
  review: 'Reviewed',
  develop: 'Submitted',
  voting: 'Voted',
  results: null,
};

/**
 * Everything a phase page and the rail say about a phase type, in this
 * process's own noun. One call rather than five maps: they are read together
 * and they have to agree.
 */
export function phaseCopy(
  process: PrototypeProcess,
  phaseType: PhaseType,
): {
  /** What the date range is called. */
  window: string;
  /**
   * The tab that holds the body card, named after what is actually in it. It
   * used to read "Form template" on every phase, which was wrong four times
   * over: a voting phase holds ballot rules, a results phase holds what gets
   * published, and the two that really are forms are forms *of something* — the
   * process's own noun, so a grant round says "Applications form" where a
   * budget says "Ideas form".
   */
  setupTab: string;
  /** The body card's title and the one line under it. */
  bodyTitle: string;
  bodyHelper: string;
  /** The people tab's own card — same shape, different subject. */
  peopleTitle: string;
  peopleHelper: string;
  /** What the phase does, for the rail. */
  blurb: string;
} {
  const { one, One, many, Many } = vocabulary(process, phaseType);

  // What a develop phase builds from is whatever the round before it collected.
  const source = vocabulary(process, 'submissions').many;

  switch (phaseType) {
    case 'submissions':
      return {
        window: `${One} window`,
        setupTab: `${Many} form`,
        bodyTitle: `${One} form`,
        bodyHelper: `Every question here becomes a field on the form people fill in.`,
        blurb: `People send in ${many}`,
        peopleTitle: 'Participants',
        peopleHelper: `The people who can send in ${article(one)} ${one}.`,
      };
    case 'review':
      return {
        window: 'Review period',
        // Not "rubric" and not "scoring": screening is often a yes or no, and
        // a name that promises a score is wrong on those phases.
        setupTab: 'Review form',
        bodyTitle: 'Review form',
        bodyHelper: `Each field is one question a reviewer answers about ${article(one)} ${one}.`,
        blurb: 'Reviewers read what came in',
        peopleTitle: 'Review panel',
        peopleHelper: `The people who read and judge the ${many}.`,
      };
    case 'develop':
      return {
        window: 'Development period',
        setupTab: `${Many} form`,
        bodyTitle: `${One} form`,
        bodyHelper: `What a full ${one} has to include, carried over from the ${source} where it was already answered.`,
        blurb: `Shortlisted ${source} become ${many}`,
        peopleTitle: 'Participants',
        peopleHelper: `The people who turn the ${source} into ${many}.`,
      };
    case 'voting':
      return {
        window: 'Voting window',
        setupTab: 'Voting methods',
        bodyTitle: 'How voting works',
        bodyHelper:
          'How people cast their vote, and what the ballot asks of them.',
        blurb: 'People decide between them',
        peopleTitle: 'Voters',
        peopleHelper: 'The people who can cast a vote in this phase.',
      };
    case 'results':
      return {
        window: 'When results are shared',
        setupTab: 'Results display',
        bodyTitle: 'How results are shown',
        bodyHelper: 'What people see when the process is done.',
        blurb: 'The outcome is published',
        peopleTitle: 'Participants',
        peopleHelper: 'The people who are told when results are published.',
      };
  }
}

/** "an idea", "a proposal" — enough for the four nouns this ever sees. */
function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? 'an' : 'a';
}

export function voteMethodMeta(
  process: PrototypeProcess,
): Record<VoteMethod, { label: string; helper: string }> {
  const { many } = vocabulary(process, 'voting');

  return {
    simple: {
      label: 'Simple voting',
      helper: `Voters select the ${many} they support, up to a set number of votes.`,
    },
    knapsack: {
      label: 'Knapsack',
      helper: `Voters build a bundle of ${many} that fits within a shared budget.`,
    },
    rank: {
      label: 'Stack rank',
      helper: `Voters order the ${many} from most to least preferred.`,
    },
  };
}

/**
 * Review is always a named group — you don't crowdsource reviewing — so it opens
 * invite-only whatever the wizard said. Every other phase inherits that answer.
 */
export function defaultAudience(
  phaseType: PhaseType,
  fromWizard: Audience,
): Audience {
  return phaseType === 'review' ? 'invite' : fromWizard;
}

function defaultToggles(phaseType: PhaseType): Record<string, boolean> {
  // Only the keys and their defaults matter here, so the wording this asks for
  // is irrelevant — any process will do.
  return Object.fromEntries(
    phaseToggles({ phases: [] } as unknown as PrototypeProcess, phaseType).map(
      (toggle) => [toggle.key, toggle.on],
    ),
  );
}

const id = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function createPhase(
  phaseType: PhaseType,
  name: string,
  wizardAudience: Audience,
): PrototypePhase {
  return {
    id: id('phase'),
    name,
    phaseType,
    fields: [],
    criteria: [],
    audience: defaultAudience(phaseType, wizardAudience),
    invitees: [],
    toggles: defaultToggles(phaseType),
    voteMethod: 'simple',
    budget: '',
    pickCount: '',
    resultsDisplay: 'full',
    configured: false,
  };
}

const DAY = 24 * 3600 * 1000;
/**
 * Seed timestamps are relative to load, so "joined 2 days ago" stays true
 * however long this prototype sits around. Safe to read at module scope: the
 * pages that render a relative time load their process in an effect, so the
 * server never renders one of these.
 */
const SEED_EPOCH = Date.now();

export const SEEDED_PROCESS: PrototypeProcess = {
  id: 'neighborhood-participatory-budget-2026',
  name: 'Neighborhood Participatory Budget 2026',
  summary:
    'Residents decide how to spend $250,000 across the six neighborhoods of the East Side.',
  steward: 'East Side Collective',
  type: 'pb',
  audience: 'anyone',
  status: 'published',
  currentPhaseIndex: 1,
  isSeed: true,
  proposalCount: 34,
  participantCount: 412,
  about:
    '<p>The East Side Collective is running its first participatory budget. Residents propose projects for their own neighborhood, a review panel checks them for feasibility, and everyone votes on what gets built.</p>',
  resources: [
    {
      id: 'seed-resource',
      title: 'How participatory budgeting works',
      url: 'https://example.org/guide',
      addedAt: SEED_EPOCH - 9 * DAY,
    },
  ],
  phases: [
    {
      ...createPhase('submissions', 'Collect ideas', 'anyone'),
      id: 'seed-phase-1',
      startDate: '2026-01-12',
      endDate: '2026-02-09',
      configured: true,
      // Two of these are Choice questions, which is what lets the Review phase
      // split its pile by focus area — see `focusAreaFields`.
      fields: [
        {
          id: 'seed-field-title',
          label: 'What are you proposing?',
          format: 'Text',
          optional: false,
        },
        {
          id: 'seed-field-detail',
          label: 'How would it work?',
          format: 'Text',
          optional: false,
        },
        {
          // Phrased as a real question so the inference has something to strip:
          // this is what produces the word "neighborhood" wherever the review
          // phase names the grouping.
          id: 'seed-field-neighborhood',
          label: 'Which neighborhood is this for?',
          format: 'Multiple choice',
          optional: false,
          options: ['Riverside', 'Northside', 'East End', 'Downtown'],
        },
        {
          id: 'seed-field-project-type',
          label: 'Project type',
          format: 'Multiple choice',
          optional: false,
          options: [
            'Parks and green space',
            'Streets and transport',
            'Arts and culture',
            'Youth programmes',
          ],
        },
        {
          id: 'seed-field-cost',
          label: 'Estimated cost',
          format: 'Text',
          optional: false,
        },
      ],
    },
    {
      ...createPhase('review', 'Screen the ideas', 'anyone'),
      id: 'seed-phase-2',
      startDate: '2026-02-10',
      endDate: '2026-03-02',
      configured: true,
      assignment: {
        mode: 'group',
        groupByFieldIds: ['seed-field-neighborhood'],
      },
      // One reviewer still has no group, so the "unassigned" state is on screen
      // without anyone having to remove one first.
      invitees: [
        {
          id: 'seed-invitee-1',
          email: 'j.okafor@cityreview.org',
          status: 'joined',
          at: SEED_EPOCH - 2 * DAY,
          focusArea: 'Riverside',
        },
        {
          id: 'seed-invitee-2',
          email: 'sam.reyes@cityreview.org',
          status: 'joined',
          at: SEED_EPOCH - 2 * DAY,
        },
        {
          id: 'seed-invitee-3',
          email: 'maria.lang@eastside.org',
          status: 'invited',
          at: SEED_EPOCH - 6 * 3600 * 1000,
          focusArea: 'Northside',
        },
      ],
    },
    {
      ...createPhase('develop', 'Build proposals', 'anyone'),
      id: 'seed-phase-3',
      startDate: '2026-03-03',
      endDate: '2026-04-06',
      configured: true,
    },
    {
      ...createPhase('voting', 'Put it to a vote', 'anyone'),
      id: 'seed-phase-4',
      startDate: '2026-04-07',
      endDate: '2026-04-28',
      configured: true,
    },
    {
      ...createPhase('results', 'Share results', 'anyone'),
      id: 'seed-phase-5',
      startDate: '2026-05-04',
      endDate: '2026-05-11',
      configured: true,
    },
  ],
};

/**
 * The dimensions a Review phase can group its pile along: every closed-answer
 * question asked by a phase that runs *before* this one. Groups are never
 * invented here — they are the answers proposers already picked from, so the
 * pile divides along a line the proposals themselves drew.
 *
 * `name` is the dimension in the process's own words — "neighborhood", not
 * "Which neighborhood is this for?". That is what an admin is choosing between,
 * and it is the only part that belongs on the option's face.
 */
export interface GroupingDimension {
  id: string;
  /** The question it came from. Behind an info affordance, never on the face. */
  label: string;
  /** "neighborhood" — the dimension itself. */
  name: string;
  /** The groups it would produce. */
  options: string[];
  phaseName: string;
}

export function groupingDimensions(
  process: PrototypeProcess,
  phaseId: string,
): GroupingDimension[] {
  const index = process.phases.findIndex((phase) => phase.id === phaseId);
  const earlier =
    index === -1 ? process.phases : process.phases.slice(0, index);

  return earlier.flatMap((phase) =>
    phase.fields
      .filter(
        (field) =>
          field.format === 'Multiple choice' &&
          (field.options?.length ?? 0) > 0,
      )
      .map((field) => ({
        id: field.id,
        label: field.label,
        name: groupNoun(field.label),
        options: field.options ?? [],
        phaseName: phase.name,
      })),
  );
}

/**
 * Stands in for the model reading the submission form.
 *
 * The real thing infers the *vocabulary*: that a question offering a set of
 * neighbourhoods means proposals can be grouped **by neighbourhood**. Here a
 * heuristic does the same job — strip the interrogative scaffolding off the
 * question and what is left is the dimension.
 */

/** "Which neighborhood is this for?" -> "neighborhood". */
export function groupNoun(label: string): string {
  const stripped = label
    .toLowerCase()
    .replace(/[?.!]+$/, '')
    .replace(/^(which|what|where|whose|who)\s+/, '')
    .replace(
      /\s+(is|are|was|were|will|do|does|did)\s+(this|it|they|these|those)(\s+(for|in|about|from))?$/,
      '',
    )
    .replace(/\s+(for|in|about)$/, '')
    .trim();

  return stripped || label.toLowerCase();
}

export function pluralise(noun: string): string {
  if (/(s|x|z|ch|sh)$/.test(noun)) {
    return `${noun}es`;
  }

  if (/[^aeiou]y$/.test(noun)) {
    return `${noun.slice(0, -1)}ies`;
  }

  return `${noun}s`;
}

/**
 * Whether this phase is taking submissions — the product's
 * `rules.proposals.submit`, which is what "Now open!" reports while a phase is
 * running. A phase that collects nothing never says it is open, however current
 * it happens to be.
 */
export function acceptsProposals(phase: PrototypePhase): boolean {
  const stored = phase.toggles.acceptProposals;

  // The product's `rules.proposals.submit` — what puts "Now open!" on a running
  // phase. It is no longer offered as a control, so a phase that has a form to
  // fill in is one that accepts submissions. A stored answer still wins: older
  // records carry one, and it is a real rule rather than something derived.
  return typeof stored === 'boolean'
    ? stored
    : phase.phaseType === 'submissions' || phase.phaseType === 'develop';
}

/**
 * Whether the phase rail is being edited, kept outside React so it survives the
 * trip into a phase page and back. Going in to set a phase up and pressing
 * `Back` should return you to the rail you left; pressing `Save` finishes the
 * job, so it returns you to the page as it will be read.
 */
const RAIL_EDIT_KEY = 'op-prototype-rail-editing';

export function isRailEditing(processId: string): boolean {
  try {
    return sessionStorage.getItem(RAIL_EDIT_KEY) === processId;
  } catch {
    return false;
  }
}

export function setRailEditing(processId: string, editing: boolean): void {
  try {
    if (editing) {
      sessionStorage.setItem(RAIL_EDIT_KEY, processId);
    } else {
      sessionStorage.removeItem(RAIL_EDIT_KEY);
    }
  } catch {
    // A prototype in a locked-down browser just loses the mode on navigation.
  }
}

/**
 * Which tab of the process page a phase editor should return to. `Edit phase`
 * is reached from the running phase, and `Back` from a screen you opened means
 * the screen you opened it from — dropping you on the overview instead is the
 * page deciding it knows better.
 *
 * Session storage for the same reason the rail's edit mode uses it: the phase
 * editor is a different route, so the state has to survive the navigation and
 * nothing else.
 */
const RETURN_TAB_KEY = 'op-prototype-return-tab';

export function returnsToCurrentPhase(processId: string): boolean {
  try {
    return sessionStorage.getItem(RETURN_TAB_KEY) === processId;
  } catch {
    return false;
  }
}

export function setReturnsToCurrentPhase(
  processId: string,
  current: boolean,
): void {
  try {
    if (current) {
      sessionStorage.setItem(RETURN_TAB_KEY, processId);
    } else {
      sessionStorage.removeItem(RETURN_TAB_KEY);
    }
  } catch {
    // A prototype in a locked-down browser just lands on the overview.
  }
}

/** An absent record reads as the default rather than as a broken one. */
export function phaseAssignment(phase: PrototypePhase): Assignment {
  return phase.assignment ?? { mode: 'open' };
}

/** The dimensions this phase is actually grouped along, in form order. */
export function assignedDimensions(
  process: PrototypeProcess,
  phase: PrototypePhase,
): GroupingDimension[] {
  const assignment = phaseAssignment(phase);

  if (assignment.mode !== 'group') {
    return [];
  }

  const chosen = new Set(assignment.groupByFieldIds ?? []);

  return groupingDimensions(process, phase.id).filter((dimension) =>
    chosen.has(dimension.id),
  );
}

/** Whether a `group` phase has been told how to categorise yet. */
export function hasGrouping(
  process: PrototypeProcess,
  phase: PrototypePhase,
): boolean {
  return assignedDimensions(process, phase).length > 0;
}

/** The categories in play, in the admin's words. */
export function groupingNames(
  process: PrototypeProcess,
  phase: PrototypePhase,
): string[] {
  return assignedDimensions(process, phase).map((dimension) => dimension.name);
}

/**
 * The categories a reviewer can be matched to. One dimension at a time, which
 * is all the picker can now produce — the answers to one submission question.
 */
export function assignedGroupValues(
  process: PrototypeProcess,
  phase: PrototypePhase,
): string[] {
  const dimensions = assignedDimensions(process, phase);

  return dimensions.length === 1 ? (dimensions[0]?.options ?? []) : [];
}

/**
 * Whether changing how proposals reach reviewers would now cost somebody
 * something. A reviewer who has finished has scored against the pile they were
 * given; re-cutting it underneath them is the consequential edit the guard is
 * for. Being invited, or having merely looked, costs nothing.
 */
export function reviewsHaveStarted(phase: PrototypePhase): boolean {
  return phase.invitees.some((person) => person.status === 'done');
}

/**
 * The Assignments card's fact sentence. Never a control — the card states what
 * is true and offers one link to change it, so the mode is readable at a glance
 * without opening anything.
 */
export function assignmentSummary(
  process: PrototypeProcess,
  phase: PrototypePhase,
): { title: string; helper: string; action: string; toGrouping?: boolean } {
  const assignment = phaseAssignment(phase);
  const meta = assignmentMeta(process)[assignment.mode];

  if (assignment.mode === 'group') {
    const names = groupingNames(process, phase);
    const category = names[0];
    const { Many } = vocabulary(process, 'review');

    // Nothing chosen yet: the option's own generic wording is still the truth,
    // and the link says what is missing rather than offering a change.
    if (!category) {
      return { ...meta, action: 'Set categories', toGrouping: true };
    }

    // The category itself, in place of the word standing in for it. "By
    // neighborhood" is the setting; "by submission category" is the menu entry
    // that led to it, and repeating the menu entry says nothing.
    return {
      title: `By ${category}`,
      helper: `Assign ${Many.toLowerCase()} to reviewers by ${category}`,
      action: 'Change',
      // A group phase opens on the categories, which is the part worth
      // revising; the modal offers the way back out to the modes.
      toGrouping: true,
    };
  }

  return { ...meta, action: 'Change' };
}

/**
 * Brings a stored process up to date with the current model. Records written
 * before a format was renamed are real work — a prototype that walked past its
 * own history would strand whatever the user last built.
 */
function migrate(process: PrototypeProcess): PrototypeProcess {
  // Written before the page's several sections collapsed into one About body.
  const legacy = (process as { sections?: { kind: string; body: string }[] })
    .sections;
  const about =
    process.about ??
    legacy?.find((section) => section.kind === 'about')?.body ??
    '';

  return {
    ...process,
    about,
    phases: process.phases.map((phase) => ({
      ...phase,
      // Written while a phase could run several vote methods at once: the first
      // one it listed is the one it led with, so that is the one it keeps.
      voteMethod: voteMethodOf(phase),
      assignment: assignmentOf(phase),
      fields: phase.fields.map((field) => ({
        ...field,
        format: RENAMED_FORMATS[field.format] ?? field.format,
      })),
    })),
  };
}

/**
 * How proposals reach reviewers, whichever model the phase was written under.
 * `distribution` was the same idea with fewer modes and one grouping question:
 * `everyone` was today's `open`, `split` is `evenly`, and `focus` is a `group`
 * with a single dimension.
 */
function assignmentOf(phase: PrototypePhase): Assignment {
  if (phase.assignment) {
    return phase.assignment;
  }

  const legacy = (
    phase as { distribution?: { mode?: string; groupByFieldId?: string } }
  ).distribution;

  if (!legacy) {
    return { mode: 'open' };
  }

  if (legacy.mode === 'split') {
    return { mode: 'evenly' };
  }

  if (legacy.mode === 'focus') {
    return {
      mode: 'group',
      groupByFieldIds: legacy.groupByFieldId ? [legacy.groupByFieldId] : [],
    };
  }

  return { mode: 'open' };
}

/**
 * The phase's vote method, whichever model it was written under. Read through
 * the on-disk shape rather than the current one: a stored phase may carry the
 * old list, the old names, or neither.
 */
function voteMethodOf(phase: PrototypePhase): VoteMethod {
  const onDisk: { voteMethod?: string; voteMethods?: string[] } = phase;
  const named = onDisk.voteMethod ?? onDisk.voteMethods?.[0];

  if (!named) {
    return 'simple';
  }

  return (
    RENAMED_VOTE_METHODS[named] ??
    VOTE_METHODS.find((method) => method === named) ??
    'simple'
  );
}

function readStored(): PrototypeProcess[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    return raw ? (JSON.parse(raw) as PrototypeProcess[]).map(migrate) : [];
  } catch {
    // A malformed value is not worth surfacing in a prototype.
    return [];
  }
}

function writeStored(processes: PrototypeProcess[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(processes));
  }
}

/**
 * A second process that ships ready to walk: live, in its first phase, with the
 * form already written. The other seed is mid-review, which is the interesting
 * state for the review surfaces but a poor place to start a demo of collecting.
 */
export const SEEDED_SUBMISSIONS_PROCESS: PrototypeProcess = {
  id: 'small-grants-fund-2026',
  name: 'Small Grants Fund 2026',
  summary:
    'Community groups apply for grants of up to $10,000, decided by a panel of residents.',
  steward: 'East Side Collective',
  type: 'grant',
  audience: 'anyone',
  status: 'published',
  // Its first phase, and it is running.
  currentPhaseIndex: 0,
  isSeed: true,
  proposalCount: 11,
  participantCount: 96,
  about:
    '<p>Small Grants funds work that already has people behind it. Groups tell us what they would do and what it costs, a panel of residents reads every application, and the fund is split between what they pick.</p>',
  resources: [],
  phases: [
    {
      ...createPhase('submissions', 'Send in your application', 'anyone'),
      id: 'fund-phase-apply',
      startDate: seedDay(-6),
      endDate: seedDay(24),
      configured: true,
      fields: [
        {
          id: 'fund-field-what',
          label: 'What would you do with the grant?',
          format: 'Text',
          optional: false,
        },
        {
          id: 'fund-field-who',
          label: 'Who is it for?',
          format: 'Text',
          optional: false,
        },
        {
          id: 'fund-field-area',
          label: 'Which part of the city is this for?',
          format: 'Multiple choice',
          optional: false,
          options: ['Riverside', 'Northside', 'East End', 'Downtown'],
        },
        {
          id: 'fund-field-amount',
          label: 'How much are you asking for?',
          format: 'Text',
          optional: false,
        },
        {
          id: 'fund-field-budget',
          label: 'Attach a budget breakdown',
          format: 'File',
          optional: true,
        },
      ],
    },
    {
      ...createPhase('review', 'Review the applications', 'invite'),
      id: 'fund-phase-review',
      startDate: seedDay(25),
      endDate: seedDay(39),
    },
    {
      ...createPhase('results', 'See the awards', 'anyone'),
      id: 'fund-phase-results',
      startDate: seedDay(45),
      endDate: seedDay(45),
    },
  ],
};

/** Everything the prototype ships with, and so everything that can be reset. */
export const SEEDED_PROCESSES: PrototypeProcess[] = [
  SEEDED_PROCESS,
  SEEDED_SUBMISSIONS_PROCESS,
];

export function loadProcesses(): PrototypeProcess[] {
  const stored = readStored();
  // A stored copy of a seed shadows the one in code — see `updateProcess`.
  const seeds = SEEDED_PROCESSES.map(
    (seed) => stored.find((process) => process.id === seed.id) ?? seed,
  );
  const rest = stored.filter(
    (process) => !SEEDED_PROCESSES.some((seed) => seed.id === process.id),
  );

  return [...seeds, ...rest];
}

/** A day either side of the seed's own "today", as a stored `YYYY-MM-DD`. */
function seedDay(offset: number): string {
  const date = new Date(SEED_EPOCH + offset * DAY);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Drop a process. Only ever offered for a draft — nothing has run in one. */
export function deleteProcess(processId: string): void {
  writeStored(readStored().filter((process) => process.id !== processId));
}

/**
 * Put a seeded process back the way it ships. The demo processes are what a
 * walkthrough starts from, and a walkthrough that edits them has no way back
 * short of clearing the browser.
 */
export function resetSeededProcess(processId: string): void {
  const seeded = SEEDED_PROCESSES.find((process) => process.id === processId);

  if (!seeded) {
    return;
  }

  writeStored(readStored().filter((process) => process.id !== processId));
}

/**
 * Whether a process shipped with the prototype rather than being made in it.
 * Derived from the seed ids rather than stored on the record, so a *duplicate*
 * of a stock process is correctly not stock — it is something the tester made.
 */
export function isStockProcess(processId: string): boolean {
  return SEEDED_PROCESSES.some((seed) => seed.id === processId);
}

/**
 * How many processes this tester has actually created. The entry modal exists
 * for somebody with a process worth duplicating, and a shared prototype hands
 * everyone a populated environment they had no part in — so the stock ones
 * don't count, and a first-time tester still meets the wizard.
 */
export function userCreatedCount(): number {
  return loadProcesses().filter((process) => !isStockProcess(process.id))
    .length;
}

/**
 * Copy a process to start another one. Structure carries over — phases, their
 * forms and rubrics, their settings and windows. Everything a run *produced*
 * does not: the people invited to it, what they submitted, and how it turned
 * out belong to the process that happened, not to the one being set up.
 *
 * The copy is always a draft. A duplicate that arrived live would be a process
 * nobody had reviewed running under a name nobody had checked.
 */
export function duplicateProcess(
  source: PrototypeProcess,
  name: string,
  steward: string,
): string {
  const processId = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;

  writeStored([
    ...readStored(),
    {
      ...source,
      id: processId,
      name,
      steward,
      status: 'draft',
      // Nothing has run in it yet, and nothing is carried over that could have.
      currentPhaseIndex: -1,
      admins: undefined,
      targetParticipants: undefined,
      targetSubmissions: undefined,
      phases: source.phases.map((phase) => ({
        ...phase,
        id: `${phase.id}-copy-${Math.random().toString(36).slice(2, 7)}`,
        invitees: [],
      })),
    },
  ]);

  return processId;
}

/**
 * Whether this is the mock process a walkthrough starts from — the one that
 * ships fully set up, and so the one worth being able to put back.
 */
export function isMockProcess(processId: string): boolean {
  return processId === SEEDED_SUBMISSIONS_PROCESS.id;
}

export function findProcess(processId: string): PrototypeProcess | undefined {
  return loadProcesses().find((process) => process.id === processId);
}

/** Turn a finished wizard draft into a stored draft process; returns its id. */
export function saveDraft(draft: ProcessDraft, phaseNames: string[]): string {
  const processId = `${slugify(draft.name)}-${Math.random().toString(36).slice(2, 7)}`;
  const created: PrototypeProcess = {
    id: processId,
    name: draft.name,
    steward: draft.steward,
    type: draft.type,
    audience: draft.audience,
    status: 'draft',
    // Nothing has started: no phase is current, none is set up.
    currentPhaseIndex: -1,
    about: '',
    resources: [],
    phases: draft.pieces.map((piece, index) => {
      const phase = createPhase(
        piece.phaseType,
        phaseNames[index] ?? piece.phaseType,
        draft.audience,
      );

      return phase;
    }),
  };

  writeStored([...readStored(), created]);

  return processId;
}

/**
 * Patch one process. The seeded process lives in code rather than storage, so
 * the first edit to it takes a copy into storage and edits that — otherwise
 * every change to the example would be silently dropped.
 */
export function updateProcess(
  processId: string,
  patch: (process: PrototypeProcess) => PrototypeProcess,
): void {
  const stored = readStored();
  if (stored.some((process) => process.id === processId)) {
    writeStored(
      stored.map((process) =>
        process.id === processId ? patch(process) : process,
      ),
    );

    return;
  }

  const fromCode = loadProcesses().find((process) => process.id === processId);

  if (fromCode) {
    writeStored([...stored, patch(fromCode)]);
  }
}

/** Patch one phase of one stored process. */
export function updatePhase(
  processId: string,
  phaseId: string,
  patch: (phase: PrototypePhase) => PrototypePhase,
): void {
  updateProcess(processId, (process) => ({
    ...process,
    phases: process.phases.map((phase) =>
      phase.id === phaseId ? patch(phase) : phase,
    ),
  }));
}

/**
 * Publishing opens the first phase, so it only makes sense once that phase can
 * actually run: something to fill in, and a window to do it in. A process with
 * no Submissions phase can therefore never publish — known, and carried over
 * from the design as an open question rather than patched here.
 */
export function isPhaseComplete(phase: PrototypePhase): boolean {
  return isPhaseReady(phase);
}

/** Every phase type there is, in the order they are offered. */
export const PHASE_TYPES: PhaseType[] = [
  'submissions',
  'review',
  'develop',
  'voting',
  'results',
];

/**
 * A process collects once and reports once; review, develop and vote can all
 * repeat. So the one-per-process types drop out of the menu once they exist.
 */
const SINGLETON_TYPES: PhaseType[] = ['submissions', 'results'];

/** What each type does, one line, for the menu that adds one. */
export function typeHelper(
  process: PrototypeProcess,
  phaseType: PhaseType,
): string {
  const { many } = vocabulary(process, phaseType);

  switch (phaseType) {
    case 'submissions':
      return 'People send something in.';
    case 'review':
      return 'A named group scores what came in.';
    case 'develop':
      return `Shortlisted entries are built up into full ${many}.`;
    case 'voting':
      return "People decide between what's left.";
    case 'results':
      return 'The outcome is published.';
  }
}

/**
 * What a phase added by hand is called before the admin renames it: what the
 * menu called it. Picking `Collect input` and getting a phase named something
 * else is the menu describing one thing and the rail showing another — and the
 * name is a field, so anyone who wants the participant-facing wording can write
 * it. What the phase actually does is the line underneath.
 */
export function newPhaseName(phaseType: PhaseType): string {
  return phaseTypeLabel(phaseType);
}

/**
 * What the add-a-phase menu calls a phase type. Plainer than the phase's own
 * default name: here you are picking a kind of step, not writing the title
 * participants will read on the timeline.
 */
export function phaseTypeLabel(phaseType: PhaseType): string {
  switch (phaseType) {
    case 'submissions':
      return 'Collect input';
    case 'review':
      return 'Review input';
    case 'develop':
      return 'Develop input';
    case 'voting':
      return 'Vote';
    case 'results':
      return 'Share results';
  }
}

/**
 * Why an offered type can't be taken yet, or `null` when it can. Developing
 * works on what came in, so it has nothing to work on until something collects
 * it — offered-but-blocked rather than hidden, so the order of assembly is
 * legible instead of the option seeming not to exist.
 */
export function phaseTypeBlocker(
  process: PrototypeProcess,
  phaseType: PhaseType,
): string | null {
  if (
    phaseType === 'develop' &&
    !process.phases.some((phase) => phase.phaseType === 'submissions')
  ) {
    return `Add a ${phaseTypeLabel('submissions').toLowerCase()} phase first`;
  }

  return null;
}

/** The types this process could still take one more of. */
export function addablePhaseTypes(process: PrototypeProcess): PhaseType[] {
  return PHASE_TYPES.filter(
    (phaseType) =>
      !(
        SINGLETON_TYPES.includes(phaseType) &&
        process.phases.some((phase) => phase.phaseType === phaseType)
      ),
  );
}

/**
 * Phases that ask something of the people in them, and so need a form written
 * before they can run. Voting and results don't — the ballot and the report are
 * the phase, and both have defaults.
 */
function needsForm(phase: PrototypePhase): boolean {
  return phase.phaseType !== 'voting' && phase.phaseType !== 'results';
}

/** Review's form is its rubric; everywhere else it is the question list. */
function hasForm(phase: PrototypePhase): boolean {
  return phase.phaseType === 'review'
    ? phase.criteria.length > 0
    : phase.fields.length > 0;
}

/** A results phase stores its one day in both, so this holds for it too. */
function hasWindow(phase: PrototypePhase): boolean {
  return !!phase.startDate && !!phase.endDate;
}

/**
 * Whether a phase could run. Being visited and saved is not the test — a phase
 * you opened and left is exactly as unable to run as one you never opened.
 */
export function isPhaseReady(phase: PrototypePhase): boolean {
  return (!needsForm(phase) || hasForm(phase)) && hasWindow(phase);
}

/**
 * The phase the admin should do next: the first one that isn't finished. `-1`
 * once every phase is done. Exactly one row offers a CTA, and this is it —
 * a rail of identical buttons tells you nothing about what to do next.
 */
const DAY_MS = 86_400_000;

/** Whole days from one date-only string to another. */
function daysBetween(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS);
}

function addDays(value: string, days: number): string {
  return new Date(Date.parse(value) + days * DAY_MS).toISOString().slice(0, 10);
}

/** A phase with a window — the only kind reordering has consequences for. */
export function isPhaseDated(
  phase: PrototypePhase,
): phase is PrototypePhase & { startDate: string; endDate: string } {
  return Boolean(phase.startDate && phase.endDate);
}

/**
 * The dates a set of phases would have in the order they are given. Every phase
 * keeps its own length: a five-day phase dropped into a fortnight-long slot is
 * still five days, it does not inherit the window it landed in. Starts run
 * sequentially from the date the process already starts on — the earliest of
 * them, which does not depend on the order — and each phase begins the day after
 * the one before it ends, which is how the schedule is already built.
 *
 * Undated phases take no time and are left alone, so a rail part way through
 * being set up reflows the phases that do have dates around them.
 */
export function reflowPhaseDates(phases: PrototypePhase[]): PrototypePhase[] {
  const dated = phases.filter(isPhaseDated);

  if (dated.length === 0) {
    return phases;
  }

  let cursor = dated
    .map((phase) => phase.startDate)
    .reduce((earliest, start) => (start < earliest ? start : earliest));

  const windows = new Map<string, { startDate: string; endDate: string }>();

  for (const phase of phases) {
    if (!isPhaseDated(phase)) {
      continue;
    }

    const endDate = addDays(
      cursor,
      daysBetween(phase.startDate, phase.endDate),
    );

    windows.set(phase.id, { startDate: cursor, endDate });
    cursor = addDays(endDate, 1);
  }

  return phases.map((phase) => {
    const window = windows.get(phase.id);

    return window ? { ...phase, ...window } : phase;
  });
}

export function nextPhaseIndex(process: PrototypeProcess): number {
  return process.phases.findIndex((phase) => !isPhaseComplete(phase));
}

export function canPublish(process: PrototypeProcess): boolean {
  return process.phases.some(
    (phase) => phase.phaseType === 'submissions' && isPhaseComplete(phase),
  );
}

/**
 * Reads on mount rather than during render: localStorage does not exist on the
 * server, and reading it in a render would make the two disagree.
 */
export function usePrototypeProcesses(): {
  processes: PrototypeProcess[];
  reload: () => void;
} {
  const [processes, setProcesses] = useState<PrototypeProcess[]>([
    SEEDED_PROCESS,
  ]);
  const reload = useCallback(() => setProcesses(loadProcesses()), []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { processes, reload };
}

/** One process, re-read after every edit so the page reflects what was stored. */
export function usePrototypeProcess(processId: string): {
  process: PrototypeProcess | null;
  isResolved: boolean;
  reload: () => void;
} {
  const [process, setProcess] = useState<PrototypeProcess | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const reload = useCallback(() => {
    setProcess(findProcess(processId) ?? null);
    setIsResolved(true);
  }, [processId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { process, isResolved, reload };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'process'
  );
}
