import { vi } from 'vitest';

// Create mock functions that can be imported and used
export const mockDb = {
  query: {
    users: {
      findFirst: vi.fn(),
    },
    decisionProcesses: {
      findFirst: vi.fn(),
    },
    processInstances: {
      findFirst: vi.fn(),
    },
    proposals: {
      findFirst: vi.fn(),
    },
    decisions: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn(),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => []),
      }),
      where: vi.fn().mockImplementation(() => []),
    }),
  }),
  selectDistinctOn: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
  $count: vi.fn().mockResolvedValue(0),
  transaction: vi.fn().mockImplementation((callback) => callback({
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn(),
    }),
  })),
};

export const mockEq = vi.fn();

// Mock the database client module
vi.mock('@op/db/client', () => ({
  db: mockDb,
  eq: mockEq,
}));

// Mock Supabase User type
vi.mock('@op/supabase/lib', () => ({
  User: vi.fn(),
}));

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks();
});