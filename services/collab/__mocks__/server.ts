/** E2E stand-in for `@op/collab/server`; the editor never reaches Tiptap Cloud there. */
export function generateCollabToken(): string {
  return 'e2e-collab-token';
}
