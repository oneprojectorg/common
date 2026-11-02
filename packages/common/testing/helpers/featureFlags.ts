import { vi } from 'vitest';

export const forceServerFlags = (on: boolean) =>
  vi.stubEnv('NEXT_PUBLIC_E2E', on ? 'true' : '');
