import { DEFAULT_MONEY_CURRENCY, isValidCurrencyCode } from '../../money';
import type { SmsBallotProposal } from './listSmsBallotProposals';
import { SMS_ELLIPSIS, SMS_MAX_BODY_LENGTH, clipSmsText } from './smsText';

const SMS_LIST_TITLE_LENGTH = 100;

const smsCurrency = (currency: string): string =>
  isValidCurrencyCode(currency) ? currency : DEFAULT_MONEY_CURRENCY;

export const formatSmsCost = (cost: number | null, currency: string): string =>
  cost === null
    ? ''
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: smsCurrency(currency),
        maximumFractionDigits: 0,
      }).format(cost);

const withCost = (title: string, cost: number | null, currency: string) =>
  cost === null
    ? `"${clipSmsText(title, SMS_LIST_TITLE_LENGTH)}"`
    : `"${clipSmsText(title, SMS_LIST_TITLE_LENGTH)}" (${formatSmsCost(cost, currency)})`;

export const formatSmsProposalInfo = (proposal: SmsBallotProposal): string => {
  const heading = `${proposal.code}: ${withCost(proposal.title, proposal.cost, proposal.currency)}.`;
  const room = SMS_MAX_BODY_LENGTH - heading.length - 1;
  const summary =
    proposal.summary && room > SMS_ELLIPSIS.length
      ? clipSmsText(proposal.summary, room)
      : null;

  return [heading, summary].filter(Boolean).join(' ');
};
