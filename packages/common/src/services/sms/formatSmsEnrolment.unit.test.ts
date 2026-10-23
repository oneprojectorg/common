import { describe, expect, it } from 'vitest';

import {
  formatSmsAddressNotFound,
  formatSmsAddressOutside,
  formatSmsAddressResolved,
  formatSmsEnrolled,
  formatSmsEnrolmentWelcome,
  formatSmsNoEnrolmentNeeded,
  formatSmsNothingToAffirm,
  formatSmsVotingClosed,
} from './formatSmsEnrolment';

describe('formatSmsEnrolmentWelcome', () => {
  it('given the decision name, then the text names it and asks for the address', () => {
    expect(formatSmsEnrolmentWelcome('Our Voice, Our Choice Budget')).toEqual([
      'Welcome to "Our Voice, Our Choice Budget". Two quick steps to register: your address, then a short affirmation. No ID needed. What\'s your address?',
    ]);
  });
});

describe('formatSmsAddressResolved', () => {
  it('given a district and the attestation, then the text names the district and quotes the attestation after the AGREE instruction', () => {
    expect(
      formatSmsAddressResolved({
        district: 'Council District 5',
        attestation: 'I affirm that I meet the eligibility requirements.',
      }),
    ).toEqual([
      'That\'s Council District 5. Reply AGREE to affirm: "I affirm that I meet the eligibility requirements."',
    ]);
  });

  it('given no district, then the text says the address was found and still asks for AGREE', () => {
    expect(
      formatSmsAddressResolved({ district: null, attestation: 'I affirm.' }),
    ).toEqual(['Address found. Reply AGREE to affirm: "I affirm."']);
  });
});

describe('address refusals', () => {
  it('given the address was not found, then the text asks for it again with street, city and ZIP', () => {
    expect(formatSmsAddressNotFound()).toEqual([
      'That address was not found. Text it again with the street, city and ZIP.',
    ]);
  });

  it('given the address is outside every district, then the text names the decision', () => {
    expect(formatSmsAddressOutside('Park Funding')).toEqual([
      'That address is outside the districts of "Park Funding", so you cannot register for it.',
    ]);
  });
});

describe('formatSmsEnrolled', () => {
  it('given a budget and a district, then the text confirms registration with both', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        district: 'Council District 5',
        budget: '$1000000',
      }),
    ).toEqual([
      "You're registered. You have $1000000 for Council District 5 proposals.",
    ]);
  });

  it('given no budget and no district, then the text confirms registration for the decision', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        district: null,
        budget: null,
      }),
    ).toEqual(['You\'re registered to vote in "Park Funding".']);
  });

  it('given a budget and no district, then the budget is for the decision', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        district: null,
        budget: '$500',
      }),
    ).toEqual([
      'You\'re registered. You have $500 for "Park Funding" proposals.',
    ]);
  });
});

describe('formatSmsNothingToAffirm', () => {
  it('then the text says there is nothing pending and how to start', () => {
    expect(formatSmsNothingToAffirm()).toEqual([
      'There is nothing to affirm. Text VOTE and a decision name to register.',
    ]);
  });
});

describe('vote replies without a registration step', () => {
  it('given a decision with no enrolment rule, then the text says no registration is needed', () => {
    expect(formatSmsNoEnrolmentNeeded('Park Funding')).toEqual([
      'No registration is needed for "Park Funding". Voting is open.',
    ]);
  });

  it('given a decision whose voting is closed, then the text says so', () => {
    expect(formatSmsVotingClosed('Park Funding')).toEqual([
      'Voting is not open for "Park Funding".',
    ]);
  });
});
