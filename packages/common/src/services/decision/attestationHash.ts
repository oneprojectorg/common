import { createHash } from 'node:crypto';

export const hashAttestation = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');
