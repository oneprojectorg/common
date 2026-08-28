import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../utils/error';
import { parsePhoneNumber } from './schemas';

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
