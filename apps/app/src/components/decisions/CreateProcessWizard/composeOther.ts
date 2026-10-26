// How the other pathway builds its phases and recap from its answers. Read by the mapping step.
import { type ReactNode, createElement } from 'react';

import type { TranslateFn } from '@/lib/i18n';

import { VOTE_CAPABILITIES } from './phasePresets';
import { subjectMeta } from './questions';
import type {
  CapabilityKey,
  Decision,
  SubmitKey,
  WizardAnswers,
  WizardCopyKey,
  WizardPhase,
} from './types';

export type OtherAnswers = Pick<
  WizardAnswers,
  'subject' | 'subjectText' | 'cadence' | 'submits' | 'decision'
>;

export function subjectPhrase(
  { subject, subjectText }: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
): string {
  const words = subjectText.trim();

  return subject === 'else' && words ? words : t(subjectMeta(subject).noun);
}

interface Intake {
  name: WizardCopyKey;
  phaseName: WizardCopyKey;
  description: WizardCopyKey;
  recap: WizardCopyKey;
}

const INTAKE: Record<SubmitKey, Intake> = {
  applications: {
    name: 'collectApplications',
    phaseName: 'sendYourApplication',
    description: 'collectApplicationsDescription',
    recap: 'recapIntakeApplications',
  },
  proposals: {
    name: 'collectProposals',
    phaseName: 'sendYourProposal',
    description: 'collectWrittenProposalsDescription',
    recap: 'recapIntakeWritten',
  },
  rough: {
    name: 'collectIdeas',
    phaseName: 'shareYourIdeas',
    description: 'collectIdeasDescription',
    recap: 'recapIntakeRough',
  },
  nominations: {
    name: 'collectNominations',
    phaseName: 'makeNomination',
    description: 'collectNominationsDescription',
    recap: 'recapIntakeNominations',
  },
  none: {
    name: 'collectSubmissions',
    phaseName: 'sendYourSubmission',
    description: 'collectSubmissionsDescription',
    recap: 'recapIntakeNone',
  },
};

const DECISION_RECAP: Record<Decision, WizardCopyKey> = {
  vote: 'recapDecisionVote',
  review: 'recapDecisionReview',
  both: 'recapDecisionBoth',
  agree: 'recapDecisionAgree',
};

const REVIEW_CAPABILITIES: CapabilityKey[] = [
  'buildScoringRubric',
  'inviteReviewersPanel',
  'scoreBlindIfYouWant',
  'chooseWhatAdvances',
];

export function composeOtherPhases(answers: OtherAnswers): WizardPhase[] {
  const submits = answers.submits ?? 'none';

  if (answers.cadence === 'ongoing') {
    // An always-open process collects something, so nothing to submit reads as proposals.
    const intake = INTAKE[submits === 'none' ? 'proposals' : submits];

    return [
      {
        name: intake.name,
        phaseName: intake.phaseName,
        kind: 'submissions',
        description: 'ongoingIntakeDescription',
        capabilities: [
          'setYourOwnQuestions',
          'inviteYourGroup',
          'letMembersCommentLikeShow',
          'noClosingDateRunsLong',
        ],
        norm: 'ongoingIntakeNorm',
      },
    ];
  }

  const decision = answers.decision ?? 'vote';
  const discussionOnly = decision === 'agree';
  const phases: WizardPhase[] = [];

  if (submits !== 'none') {
    const intake = INTAKE[submits];
    const supportCapabilities: CapabilityKey[] = discussionOnly
      ? ['letPeopleCommentLikeShow']
      : [];

    phases.push({
      name: intake.name,
      phaseName: intake.phaseName,
      kind: 'submissions',
      description: intake.description,
      capabilities: [
        'setYourOwnQuestions',
        'openAllInviteOnly',
        'addDeadline',
        ...supportCapabilities,
      ],
    });
  }

  if (decision === 'both' || (decision === 'review' && submits === 'rough')) {
    phases.push({
      name: 'narrowDown',
      phaseName: 'shortlisting',
      kind: 'review',
      description:
        decision === 'both'
          ? 'narrowDownDescription'
          : 'narrowDownToWorkUpDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (submits === 'rough') {
    phases.push({
      name: 'workThemUp',
      phaseName: 'buildThemUp',
      kind: 'submissions',
      description: 'workThemUpDescription',
      capabilities: [
        'buildWhatWasAlreadySubmitted',
        'addQuestionsFullerVersion',
        'setDeadline',
      ],
    });
  }

  if (decision === 'review') {
    phases.push({
      name: 'reviewDecide',
      phaseName: 'reviewDecide',
      kind: 'review',
      description: 'reviewDecideDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (decision === 'vote' || decision === 'both') {
    phases.push({
      name: subjectMeta(answers.subject).voteName,
      phaseName: 'votePhase',
      kind: 'voting',
      description: 'groupVoteDescription',
      capabilities: VOTE_CAPABILITIES,
    });
  }

  phases.push({
    name: 'shareWhatWasDecided',
    phaseName: 'seeWhatWasDecided',
    kind: 'results',
    capabilities: [
      discussionOnly ? 'publishWhatGroupLanded' : 'publishOutcome',
      'showTitlesOnlyFullEntries',
      'notifyEveryoneWhoTookPart',
    ],
  });

  return phases;
}

export function describeOther(
  answers: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
): ReactNode {
  const subject = subjectPhrase(answers, t);
  const bdi = (chunks: ReactNode) => createElement('bdi', null, chunks);

  if (answers.cadence === 'ongoing') {
    return t.rich('recapOngoing', { subject, bdi });
  }

  return t.rich('recapTimeline', {
    subject,
    bdi,
    intake: t(INTAKE[answers.submits ?? 'none'].recap),
    call: t(DECISION_RECAP[answers.decision ?? 'vote']),
  });
}
