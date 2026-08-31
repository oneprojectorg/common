import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils/error';
import { normalizePhoneNumber, parsePhoneNumber } from './schemas';

describe('parsePhoneNumber', () => {
  it.each(['+15005550006', '+442071838750', '+8613800138000'])(
    'accepts the E.164 number %s',
    (value) => {
      expect(parsePhoneNumber(value)).toBe(value);
    },
  );

  it.each([
    ['15005550006', 'no leading plus'],
    ['+05005550006', 'country code starting with zero'],
    ['+1500555000612345', 'more than 15 digits'],
    ['+1 500 555 0006', 'spaces'],
    ['+1-500-555-0006', 'dashes'],
    ['', 'empty'],
  ])('rejects %s (%s)', (value) => {
    expect(() => parsePhoneNumber(value)).toThrow(ValidationError);
  });

  it.each([
    ['+15005550006\nBcc: attacker@example.com', 'LF'],
    ['+15005550006\r\nBcc: attacker@example.com', 'CRLF'],
  ])('rejects a number carrying %s (%s)', (value) => {
    // A newline reaching a provider's HTTP client is a header-injection
    // vector, the same risk safeEmailSchema guards in services/emails.
    expect(() => parsePhoneNumber(value)).toThrow(ValidationError);
  });

  it('names the field so the caller can report which input was wrong', () => {
    try {
      parsePhoneNumber('nope');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fieldErrors).toHaveProperty('phone');
    }
  });
});

/**
 * The panel enables its submit button on this result, and sends it.
 *
 * A number that normalizes into a different country still parses, so nothing
 * downstream objects: the button lights up and a stranger receives the text.
 */
describe('normalizePhoneNumber', () => {
  it.each([
    ['(818) 212-4554', '+18182124554', 'a ten-digit number as people type it'],
    ['818-212-4554', '+18182124554', 'dashes'],
    ['818.212.4554', '+18182124554', 'dots'],
    ['1 818 212 4554', '+18182124554', 'a leading country code'],
    ['+1 818 212 4554', '+18182124554', 'an E.164 number with spaces'],
    ['  +18182124554  ', '+18182124554', 'surrounding space'],
    ['+442071838750', '+442071838750', 'a number already in E.164'],
    ['+44 20 7183 8750', '+442071838750', 'a foreign number with spaces'],
  ])('turns %s into %s (%s)', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it('leaves an eleven-digit national number alone rather than guessing', () => {
    // A London number keeps its trunk zero, so it is eleven digits and does
    // not match either North American shape. It comes back unchanged and fails
    // validation, which is the outcome we want.
    const national = '020 7183 8750';

    const normalized = normalizePhoneNumber(national);

    expect(normalized).not.toBe('+12071838750');
    expect(() => parsePhoneNumber(normalized)).toThrow(ValidationError);
  });

  it('assumes a bare ten-digit number is North American', () => {
    // The known limit of this function, pinned so a change is deliberate. Ten
    // bare digits are read as a US or Canadian number, which is right for
    // where this ships and wrong for a national number of that length written
    // without its country code. Such a number normalizes to a valid-looking
    // `+1` number, passes validation, and a stranger receives the text.
    //
    // Ask for the country code in the field before serving somewhere this
    // matters, rather than widening the guess here.
    expect(normalizePhoneNumber('0142685300')).toBe('+10142685300');
  });
});
