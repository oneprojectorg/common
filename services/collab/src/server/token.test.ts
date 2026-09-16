import jwt from 'jsonwebtoken';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { generateCollabToken } from './token';

const ENVIRONMENT_ID = 'test-environment';

function makeKeyPair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
}

const { privateKey, publicKey } = makeKeyPair();

afterEach(() => {
  delete process.env.TIPTAP_PRIVATE_KEY;
  delete process.env.TIPTAP_ENVIRONMENT_ID;
});

describe('generateCollabToken', () => {
  it('signs an ES256 token that grants one document to the caller', () => {
    process.env.TIPTAP_PRIVATE_KEY = privateKey;
    process.env.TIPTAP_ENVIRONMENT_ID = ENVIRONMENT_ID;

    const token = generateCollabToken({
      userId: 'user-1',
      documentName: 'proposal-abc',
    });

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['ES256'],
      issuer: ENVIRONMENT_ID,
      audience: 'Documents',
    });

    if (typeof decoded === 'string') {
      throw new Error('Expected a decoded JWT payload, got a string');
    }

    expect(decoded.sub).toBe('user-1');
    expect(decoded.aud).toEqual(['Documents']);
    expect(decoded.permissions).toEqual([
      { action: 'Documents:Read', resource: 'proposal-abc' },
      { action: 'Documents:Write', resource: 'proposal-abc' },
    ]);

    const header = jwt.decode(token, { complete: true })?.header;
    expect(header?.alg).toBe('ES256');

    expect(decoded.iat).toBeTypeOf('number');
    expect(decoded.exp).toBeTypeOf('number');
    expect(decoded.exp! - decoded.iat!).toBe(30 * 60);
  });

  it('accepts a private key stored on one line with escaped newlines', () => {
    process.env.TIPTAP_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
    process.env.TIPTAP_ENVIRONMENT_ID = ENVIRONMENT_ID;

    const token = generateCollabToken({
      userId: 'user-1',
      documentName: 'proposal-abc',
    });

    expect(() =>
      jwt.verify(token, publicKey, { algorithms: ['ES256'] }),
    ).not.toThrow();
  });

  it('does not verify against another key pair', () => {
    process.env.TIPTAP_PRIVATE_KEY = privateKey;
    process.env.TIPTAP_ENVIRONMENT_ID = ENVIRONMENT_ID;

    const token = generateCollabToken({
      userId: 'user-1',
      documentName: 'proposal-abc',
    });

    const otherPublicKey = createPublicKey(makeKeyPair().privateKey);

    expect(() =>
      jwt.verify(token, otherPublicKey, { algorithms: ['ES256'] }),
    ).toThrow();
  });

  it('throws when the signing configuration is unset', () => {
    expect(() =>
      generateCollabToken({ userId: 'user-1', documentName: 'proposal-abc' }),
    ).toThrow(/TIPTAP_PRIVATE_KEY/);
  });
});
