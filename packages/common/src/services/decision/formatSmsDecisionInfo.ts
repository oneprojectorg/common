import { clipSmsText } from './smsText';

const SMS_DECISION_NAME_LENGTH = 100;

export const formatSmsDecisionInfo = ({
  name,
  phaseName,
  votingOpen,
  proposalCount,
}: {
  name: string;
  phaseName: string | null;
  votingOpen: boolean;
  proposalCount: number;
}): string =>
  [
    `"${clipSmsText(name, SMS_DECISION_NAME_LENGTH)}":`,
    phaseName === null ? 'no phase open,' : `${phaseName} phase,`,
    votingOpen ? 'voting open,' : 'voting closed,',
    `${proposalCount} proposal${proposalCount === 1 ? '' : 's'}.`,
  ].join(' ');
