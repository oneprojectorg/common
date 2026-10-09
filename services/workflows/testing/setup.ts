import { vi } from 'vitest';

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
