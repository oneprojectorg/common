import { vi } from 'vitest';

/** Forces every server flag on or off through the E2E switch; unstub after. */
export const forceServerFlags = (on: boolean) =>
  vi.stubEnv('NEXT_PUBLIC_E2E', on ? 'true' : '');
