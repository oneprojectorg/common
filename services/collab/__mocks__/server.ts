/** E2E stand-in for `@op/collab/server`; the editor never reaches Tiptap Cloud there. */
import type { GenerateCollabTokenInput } from '../src/server/token';

export type { GenerateCollabTokenInput };

export function generateCollabToken(_input: GenerateCollabTokenInput): string {
  return 'e2e-collab-token';
}
