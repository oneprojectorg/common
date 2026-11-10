import { describe, expect, it } from 'vitest';

import {
  formatSmsAddressNotFound,
  formatSmsAddressOutside,
  formatSmsAddressResolved,
  formatSmsAffirmOrNewAddress,
  formatSmsEnrolled,
  formatSmsEnrolmentWelcome,
  formatSmsNoEnrolmentNeeded,
  formatSmsNothingToAffirm,
  formatSmsVotingClosed,
} from './formatSmsEnrolment';

describe('formatSmsEnrolmentWelcome', () => {
  it('given the decision name, then the text names it and asks for the address', () => {
    expect(formatSmsEnrolmentWelcome('Our Voice, Our Choice Budget')).toEqual([
      [
        'Welcome to "Our Voice, Our Choice Budget".',
        'Two quick steps to register: your address, then a short affirmation. No ID needed.',
        "What's your address?",
      ].join('\n'),
    ]);
  });
});

describe('formatSmsAddressResolved', () => {
  it('given a district and the attestation, then the text names the district, quotes the attestation after the AGREE instruction, and offers a retry', () => {
    expect(
      formatSmsAddressResolved({
        termLabel: 'Council District 5',
        decisionName: 'City Budget',
        attestation: 'I affirm that I meet the eligibility requirements.',
      }),
    ).toEqual([
      [
        "That's Council District 5.",
        'Reply AGREE to register for "City Budget":',
        '"I affirm that I meet the eligibility requirements."',
        'Wrong district? Text a new address.',
      ].join('\n'),
    ]);
  });

  it('given no district, then the text says the address was found and still asks for AGREE', () => {
    expect(
      formatSmsAddressResolved({
        termLabel: null,
        decisionName: 'City Budget',
        attestation: 'I affirm.',
      }),
    ).toEqual([
      [
        'Address found.',
        'Reply AGREE to register for "City Budget":',
        '"I affirm."',
      ].join('\n'),
    ]);
  });
});

describe('address refusals', () => {
  it('given the address was not found, then the text asks for it again with street, city and ZIP', () => {
    expect(formatSmsAddressNotFound()).toEqual([
      'That address was not found. Text it again with the street, city and ZIP.',
    ]);
  });

  it('given the address is outside every district, then the text names the decision and points at SHOW', () => {
    expect(formatSmsAddressOutside('Park Funding')).toEqual([
      'That address is outside the districts of "Park Funding", so you cannot register for it. Text SHOW to see your other decisions.',
    ]);
  });

  it('given a reply that is neither AGREE nor an address while the affirmation waits, then the text offers both paths', () => {
    expect(formatSmsAffirmOrNewAddress()).toEqual([
      'Reply AGREE to register, or text your full address (street, city and ZIP) to change your district.',
    ]);
  });
});

describe('formatSmsEnrolled', () => {
  it('given a budget and a district, then the text confirms registration with both and points at PROPOSALS', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        termLabel: 'Council District 5',
        budget: '$1000000',
      }),
    ).toEqual([
      "You're registered. You have $1000000 for Council District 5 proposals. Text PROPOSALS to browse the ballot.",
    ]);
  });

  it('given no budget and no district, then the text confirms registration for the decision and points at PROPOSALS', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        termLabel: null,
        budget: null,
      }),
    ).toEqual([
      'You\'re registered to vote in "Park Funding". Text PROPOSALS to browse the ballot.',
    ]);
  });

  it('given a budget and no district, then the budget is for the decision', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        termLabel: null,
        budget: '$500',
      }),
    ).toEqual([
      'You\'re registered. You have $500 for "Park Funding" proposals. Text PROPOSALS to browse the ballot.',
    ]);
  });

  it('given a slug for the shared number, then the PROPOSALS hint carries it', () => {
    expect(
      formatSmsEnrolled({
        decisionName: 'Park Funding',
        termLabel: null,
        budget: null,
        slug: 'park-funding',
      }),
    ).toEqual([
      'You\'re registered to vote in "Park Funding". Text PROPOSALS park-funding to browse the ballot.',
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
  it('given a decision with no enrolment rule, then the text says no registration is needed and points at PROPOSALS', () => {
    expect(formatSmsNoEnrolmentNeeded('Park Funding')).toEqual([
      'No registration is needed for "Park Funding". Voting is open. Text PROPOSALS to browse the ballot.',
    ]);
  });

  it('given a slug for the shared number, then the PROPOSALS hint carries it', () => {
    expect(formatSmsNoEnrolmentNeeded('Park Funding', 'park-funding')).toEqual([
      'No registration is needed for "Park Funding". Voting is open. Text PROPOSALS park-funding to browse the ballot.',
    ]);
  });

  it('given a decision whose voting is closed, then the text says so and points at SHOW', () => {
    expect(formatSmsVotingClosed('Park Funding')).toEqual([
      'Voting is not open for "Park Funding". Text SHOW to see your decisions.',
    ]);
  });
});
