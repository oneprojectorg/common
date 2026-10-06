import { describe, expect, it } from 'vitest';

import { parseFeatureFlagOverrides } from './featureFlagOverrides';

describe('parseFeatureFlagOverrides', () => {
  it('given no value, when parsed, then nothing is overridden', () => {
    expect(parseFeatureFlagOverrides(undefined)).toEqual(new Map());
    expect(parseFeatureFlagOverrides('')).toEqual(new Map());
  });

  it('given flags forced on and off, when parsed, then each keeps its state', () => {
    expect(
      parseFeatureFlagOverrides('sms-signup:true,sms-login:false'),
    ).toEqual(
      new Map([
        ['sms-signup', true],
        ['sms-login', false],
      ]),
    );
  });

  it('given spaces around entries, when parsed, then they are ignored', () => {
    expect(
      parseFeatureFlagOverrides(' sms-signup : true , sms-login:false '),
    ).toEqual(
      new Map([
        ['sms-signup', true],
        ['sms-login', false],
      ]),
    );
  });

  it('given a state that is not true or false, when parsed, then the entry is skipped so PostHog decides', () => {
    expect(
      parseFeatureFlagOverrides('sms-signup:TRUE,sms-login:false'),
    ).toEqual(new Map([['sms-login', false]]));
    expect(parseFeatureFlagOverrides('sms-signup:yes')).toEqual(new Map());
  });

  it('given an entry with no state or no key, when parsed, then it is skipped', () => {
    expect(
      parseFeatureFlagOverrides('sms-signup,:true,sms-login:true'),
    ).toEqual(new Map([['sms-login', true]]));
  });
});
