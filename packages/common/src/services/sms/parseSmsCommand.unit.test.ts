import { SMS_ARGUMENT_KEYWORDS, SMS_BARE_KEYWORDS } from '@op/core/sms';
import { describe, expect, it } from 'vitest';

import { parseSmsCommand } from './parseSmsCommand';

describe('parseSmsCommand', () => {
  const none = { keyword: null, argument: null };
  const bare = (keyword: string) => ({ keyword, argument: null });

  it.each(SMS_BARE_KEYWORDS)(
    'given %s alone in any case or with trailing punctuation, when parsed, then it is a bare keyword',
    (keyword) => {
      expect(parseSmsCommand(keyword)).toEqual(bare(keyword));
      expect(parseSmsCommand(` ${keyword.toUpperCase()} `)).toEqual(
        bare(keyword),
      );
      expect(parseSmsCommand(`${keyword}!`)).toEqual(bare(keyword));
    },
  );

  it('given a bare keyword followed by other words, when parsed, then nothing is recognised', () => {
    expect(parseSmsCommand('join me')).toEqual(none);
    expect(parseSmsCommand('join the park vote')).toEqual(none);
  });

  it.each(SMS_ARGUMENT_KEYWORDS)(
    'given %s followed by an argument, when parsed, then the argument is kept, lowercased',
    (keyword) => {
      expect(parseSmsCommand(`${keyword.toUpperCase()} Columbus`)).toEqual({
        keyword,
        argument: 'columbus',
      });
      expect(parseSmsCommand(`${keyword}: 218!`)).toEqual({
        keyword,
        argument: '218',
      });
      expect(parseSmsCommand(`${keyword} 101.`)).toEqual({
        keyword,
        argument: '101',
      });
      expect(parseSmsCommand(`${keyword} columbus.`)).toEqual({
        keyword,
        argument: 'columbus',
      });
      expect(parseSmsCommand(keyword)).toEqual(bare(keyword));
    },
  );

  it('given a word that starts with a keyword, when parsed, then nothing is recognised', () => {
    expect(parseSmsCommand('joined')).toEqual(none);
    expect(parseSmsCommand('shown')).toEqual(none);
    expect(parseSmsCommand('showing columbus')).toEqual(none);
  });

  it('given only digits or nothing, when parsed, then nothing is recognised', () => {
    expect(parseSmsCommand('214')).toEqual(none);
    expect(parseSmsCommand('12345678901')).toEqual(none);
    expect(parseSmsCommand('')).toEqual(none);
  });
});
