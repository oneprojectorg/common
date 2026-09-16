/**
 * E2E stand-in for `@op/collab/server`. The editor never reaches Tiptap Cloud
 * in e2e, so the token only has to exist — no key material is needed.
 */
import type { GenerateCollabTokenInput } from '../src/server/token';

export type { GenerateCollabTokenInput };

export function generateCollabToken(_input: GenerateCollabTokenInput): string {
  return 'e2e-collab-token';
}
