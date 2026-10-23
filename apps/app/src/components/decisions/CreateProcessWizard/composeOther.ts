// How the other pathway builds its phases and recap from four answers. Read by the mapping step.
import { type ReactNode, createElement } from 'react';

import type { TranslateFn } from '@/lib/i18n';

import type {
  Decision,
  WizardPhase,
  Subject,
  SubjectAnswer,
  SubmitKey,
  WizardAnswers,
  WizardCopyKey,
} from './types';

export type OtherAnswers = Pick<
  WizardAnswers,
  'subject' | 'cadence' | 'submits' | 'decision'
>;

const SUBJECT_NOUN: Record<Subject, WizardCopyKey> = {
  funding: 'subjectFundingNoun',
  ideas: 'subjectIdeasNoun',
  people: 'subjectPeopleNoun',
  else: 'subjectElseNoun',
};

export function subjectPhrase(
  subject: SubjectAnswer | null,
  t: TranslateFn<'decisions.createWizard'>,
): string {
  if (subject?.kind === 'else' && subject.text.trim()) {
    return subject.text.trim();
  }

  return t(SUBJECT_NOUN[subject?.kind ?? 'else']);
}

const INTAKE_NAME: Record<SubmitKey, WizardCopyKey> = {
  applications: 'collectApplications',
  proposals: 'collectProposals',
  rough: 'collectIdeas',
  nominations: 'collectNominations',
  none: 'collectSubmissions',
};

const INTAKE_PHASE_NAME: Record<SubmitKey, WizardCopyKey> = {
  applications: 'sendYourApplication',
  proposals: 'sendYourProposal',
  rough: 'shareYourIdeas',
  nominations: 'makeNomination',
  none: 'sendYourSubmission',
};

const INTAKE_DESCRIPTION: Record<SubmitKey, WizardCopyKey> = {
  applications: 'collectApplicationsDescription',
  proposals: 'collectWrittenProposalsDescription',
  rough: 'collectIdeasDescription',
  nominations: 'collectNominationsDescription',
  none: 'collectSubmissionsDescription',
};

const REVIEW_CAPABILITIES: WizardCopyKey[] = [
  'buildScoringRubric',
  'inviteReviewersPanel',
  'scoreBlindIfYouWant',
  'chooseWhatAdvances',
];

export function composeOtherPhases(answers: OtherAnswers): WizardPhase[] {
  const submits = answers.submits ?? 'none';

  if (answers.cadence === 'ongoing') {
    return [
      {
        name: INTAKE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseName:
          INTAKE_PHASE_NAME[submits === 'none' ? 'proposals' : submits],
        phaseType: 'submissions',
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
    const supportCapabilities: WizardCopyKey[] = discussionOnly
      ? ['letPeopleCommentLikeShow']
      : [];

    phases.push({
      name: INTAKE_NAME[submits],
      phaseName: INTAKE_PHASE_NAME[submits],
      phaseType: 'submissions',
      description: INTAKE_DESCRIPTION[submits],
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
      phaseType: 'review',
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
      phaseType: 'submissions',
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
      phaseType: 'review',
      description: 'reviewDecideDescription',
      capabilities: REVIEW_CAPABILITIES,
    });
  }

  if (decision === 'vote' || decision === 'both') {
    phases.push({
      name: answers.subject?.kind === 'people' ? 'holdVote' : 'putVote',
      phaseName: 'votePhase',
      phaseType: 'voting',
      description: 'groupVoteDescription',
      capabilities: [
        'chooseHowPeopleVote',
        'combineWaysVoting',
        'decideWhoCanVote',
        'keepVotesAnonymous',
      ],
    });
  }

  phases.push({
    name: 'shareWhatWasDecided',
    phaseName: 'seeWhatWasDecided',
    phaseType: 'results',
    capabilities: [
      discussionOnly ? 'publishWhatGroupLanded' : 'publishOutcome',
      'showTitlesOnlyFullEntries',
      'notifyEveryoneWhoTookPart',
    ],
  });

  return phases;
}

const INTAKE_RECAP: Record<SubmitKey, WizardCopyKey> = {
  none: 'recapIntakeNone',
  rough: 'recapIntakeRough',
  nominations: 'recapIntakeNominations',
  applications: 'recapIntakeApplications',
  proposals: 'recapIntakeWritten',
};

const DECISION_RECAP: Record<Decision, WizardCopyKey> = {
  vote: 'recapDecisionVote',
  review: 'recapDecisionReview',
  both: 'recapDecisionBoth',
  agree: 'recapDecisionAgree',
};

export function describeOther(
  answers: OtherAnswers,
  t: TranslateFn<'decisions.createWizard'>,
): ReactNode {
  const subject = subjectPhrase(answers.subject, t);
  const bdi = (chunks: ReactNode) => createElement('bdi', null, chunks);

  if (answers.cadence === 'ongoing') {
    return t.rich('recapOngoing', { subject, bdi });
  }

  return t.rich('recapTimeline', {
    subject,
    bdi,
    intake: t(INTAKE_RECAP[answers.submits ?? 'none']),
    call: t(DECISION_RECAP[answers.decision ?? 'vote']),
  });
}
