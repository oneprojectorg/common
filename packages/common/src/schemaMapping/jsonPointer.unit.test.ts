import { describe, expect, it } from 'vitest';

import {
  parseJsonPointer,
  readJsonPointer,
  writeJsonPointer,
} from './jsonPointer';

describe('parseJsonPointer', () => {
  it('splits a pointer and unescapes ~1 and ~0', () => {
    expect(parseJsonPointer('')).toEqual([]);
    expect(parseJsonPointer('/a~1b/c~0d/~01')).toEqual(['a/b', 'c~d', '~1']);
    expect(parseJsonPointer('/')).toEqual(['']);
  });

  it('rejects a pointer without a leading slash or with a bad escape', () => {
    expect(parseJsonPointer('title')).toBeUndefined();
    expect(parseJsonPointer('/a~2')).toBeUndefined();
    expect(parseJsonPointer('/a~')).toBeUndefined();
  });

  it('rejects prototype tokens but accepts keys that only start with underscores', () => {
    expect(parseJsonPointer('/__proto__')).toBeUndefined();
    expect(parseJsonPointer('/a/prototype')).toBeUndefined();
    expect(parseJsonPointer('/constructor/name')).toBeUndefined();
    expect(parseJsonPointer('/__overall_recommendation')).toEqual([
      '__overall_recommendation',
    ]);
  });
});

describe('readJsonPointer', () => {
  const data = {
    'a/b': 1,
    'c~d': 2,
    costs: [{ amount: 10 }, { amount: 20 }],
  };

  it('reads escaped keys and array items by index', () => {
    expect(readJsonPointer({ data, pointer: '/a~1b' })).toBe(1);
    expect(readJsonPointer({ data, pointer: '/c~0d' })).toBe(2);
    expect(readJsonPointer({ data, pointer: '/costs/1/amount' })).toBe(20);
    expect(readJsonPointer({ data, pointer: '' })).toBe(data);
  });

  it('gives no value for a missing path, a bad index or an inherited key', () => {
    expect(readJsonPointer({ data, pointer: '/missing/key' })).toBeUndefined();
    expect(readJsonPointer({ data, pointer: '/costs/2' })).toBeUndefined();
    expect(readJsonPointer({ data, pointer: '/costs/01' })).toBeUndefined();
    expect(readJsonPointer({ data, pointer: '/costs/-' })).toBeUndefined();
    expect(readJsonPointer({ data, pointer: '/toString' })).toBeUndefined();
    expect(
      readJsonPointer({ data, pointer: '/constructor/prototype' }),
    ).toBeUndefined();
  });
});

describe('writeJsonPointer', () => {
  it('creates intermediate objects', () => {
    const target: Record<string, unknown> = {};

    expect(
      writeJsonPointer({ target, pointer: '/budget/amount', value: 5 }),
    ).toBe(true);
    expect(target).toEqual({ budget: { amount: 5 } });
  });

  it('refuses an empty pointer, a prototype token or a path through a non-object', () => {
    const target: Record<string, unknown> = { title: 'Park' };

    expect(writeJsonPointer({ target, pointer: '', value: 1 })).toBe(false);
    expect(
      writeJsonPointer({ target, pointer: '/__proto__/polluted', value: 1 }),
    ).toBe(false);
    expect(writeJsonPointer({ target, pointer: '/title/text', value: 1 })).toBe(
      false,
    );
    expect(target).toEqual({ title: 'Park' });
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});
