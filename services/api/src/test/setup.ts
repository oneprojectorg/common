import { vi } from 'vitest';

// Mock environment variables
vi.mock('@op/core', async () => {
  const actual = await vi.importActual('@op/core');
  return {
    ...actual,
    // Add any specific mocks for core utilities if needed
  };
});

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks();
});
