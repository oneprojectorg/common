import { clipSmsText } from './text';

const SMS_DECISION_LINE_LENGTH = 160;
const SMS_DECISION_NAME_MIN_LENGTH = 20;

export const formatSmsDecisionInfo = ({
  name,
  slug,
  phaseName,
  votingOpen,
  proposalCount,
}: {
  name: string;
  slug: string;
  phaseName: string | null;
  votingOpen: boolean;
  proposalCount: number;
}): string => {
  const tail = [
    phaseName === null ? 'no phase open,' : `${phaseName} phase,`,
    votingOpen ? 'voting open,' : 'voting closed,',
    `${proposalCount} proposal${proposalCount === 1 ? '' : 's'}.`,
  ].join(' ');
  const fixed = `"" (${slug}): ${tail}`;
  const nameRoom = Math.max(
    SMS_DECISION_NAME_MIN_LENGTH,
    SMS_DECISION_LINE_LENGTH - fixed.length,
  );
  const infoLine = `"${clipSmsText(name, nameRoom)}" (${slug}): ${tail}`;

  return votingOpen
    ? `${infoLine}\nText VOTE ${slug} to register, or PROPOSALS ${slug} to browse.`
    : infoLine;
};
