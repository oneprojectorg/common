import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';

import { generateCollabToken } from './token';

const SECRET = 'test-collab-secret';

afterEach(() => {
  delete process.env.TIPTAP_SECRET;
});

describe('generateCollabToken', () => {
  it('signs an HS256 token scoped to the one document', () => {
    process.env.TIPTAP_SECRET = SECRET;

    const token = generateCollabToken({
      userId: 'user-1',
      documentName: 'proposal-abc',
    });

    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });

    if (typeof decoded === 'string') {
      throw new Error('Expected a decoded JWT payload, got a string');
    }

    expect(decoded.sub).toBe('user-1');
    expect(decoded.allowedDocumentNames).toEqual(['proposal-abc']);

    const header = jwt.decode(token, { complete: true })?.header;
    expect(header?.alg).toBe('HS256');

    expect(decoded.iat).toBeTypeOf('number');
    expect(decoded.exp).toBeTypeOf('number');
    expect(decoded.exp! - decoded.iat!).toBe(60 * 60);
  });

  it('rejects a token signed with a different secret', () => {
    process.env.TIPTAP_SECRET = SECRET;

    const token = generateCollabToken({
      userId: 'user-1',
      documentName: 'proposal-abc',
    });

    expect(() => jwt.verify(token, 'another-secret')).toThrow();
  });

  it('throws when TIPTAP_SECRET is unset', () => {
    expect(() =>
      generateCollabToken({ userId: 'user-1', documentName: 'proposal-abc' }),
    ).toThrow(/TIPTAP_SECRET/);
  });
});
