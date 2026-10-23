import { clipSmsText, splitSmsBody } from './text';

const SMS_DECISION_NAME_LENGTH = 80;
const SMS_DISTRICT_LENGTH = 80;

const quoted = (name: string): string =>
  `"${clipSmsText(name, SMS_DECISION_NAME_LENGTH)}"`;

export const formatSmsEnrolmentWelcome = (decisionName: string): string[] =>
  splitSmsBody({
    lines: [
      `Welcome to ${quoted(decisionName)}. Two quick steps to register: your address, then a short affirmation. No ID needed. What's your address?`,
    ],
  });

export const formatSmsAddressResolved = ({
  district,
  attestation,
}: {
  district: string | null;
  attestation: string;
}): string[] =>
  splitSmsBody({
    lines: [
      `${district ? `That's ${clipSmsText(district, SMS_DISTRICT_LENGTH)}.` : 'Address found.'} Reply AGREE to affirm: "${attestation}"`,
    ],
  });

export const formatSmsAddressNotFound = (): string[] => [
  'That address was not found. Text it again with the street, city and ZIP.',
];

export const formatSmsAddressOutside = (decisionName: string): string[] =>
  splitSmsBody({
    lines: [
      `That address is outside the districts of ${quoted(decisionName)}, so you cannot register for it.`,
    ],
  });

export const formatSmsEnrolled = ({
  decisionName,
  district,
  budget,
}: {
  decisionName: string;
  district: string | null;
  budget: string | null;
}): string[] => {
  const scope = district
    ? clipSmsText(district, SMS_DISTRICT_LENGTH)
    : quoted(decisionName);
  return splitSmsBody({
    lines: [
      budget
        ? `You're registered. You have ${budget} for ${scope} proposals.`
        : `You're registered to vote in ${quoted(decisionName)}.`,
    ],
  });
};

export const formatSmsNothingToAffirm = (): string[] => [
  'There is nothing to affirm. Text VOTE and a decision name to register.',
];

export const formatSmsNoEnrolmentNeeded = (decisionName: string): string[] =>
  splitSmsBody({
    lines: [
      `No registration is needed for ${quoted(decisionName)}. Voting is open.`,
    ],
  });

export const formatSmsVotingClosed = (decisionName: string): string[] =>
  splitSmsBody({
    lines: [`Voting is not open for ${quoted(decisionName)}.`],
  });

export const SMS_VOTE_NEEDS_DECISION_MESSAGE =
  'Text VOTE and a decision name, for example VOTE columbus.';
