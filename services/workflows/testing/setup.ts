import { vi } from 'vitest';

import './mocks/otel';

vi.mock('@op/analytics/client', () => ({
  default: () => ({
    capture() {},
    identify() {},
    async isFeatureEnabled() {
      return false;
    },
    async shutdown() {},
  }),
}));
vi.mock('@op/common/src/services/notification/provider', async () =>
  (await import('./mocks/sms')).smsProviderMock(),
);
vi.mock('@op/emails', async (importOriginal) =>
  (await import('./mocks/email')).emailMock(importOriginal),
);
// The shared setup's `vi.mock('@op/events')` strips `inngest.createFunction`.
vi.mock('../../../packages/common/testing/setup', async () => {
  const { createSBServiceClient } = await import('@op/supabase/server');
  return {
    supabaseTestClient: createSBServiceClient(),
    supabaseTestAdminClient: createSBServiceClient(),
  };
});
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
