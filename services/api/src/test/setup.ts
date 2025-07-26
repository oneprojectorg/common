import { vi, beforeEach } from "vitest"

// Mock Next.js server
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: vi.fn(),
}))

// Mock Axiom NextJS
vi.mock("@axiomhq/nextjs", () => ({
  withAxiom: vi.fn((handler) => handler),
}))

// Mock environment variables
vi.mock("@op/core", async () => {
  const actual = await vi.importActual("@op/core")
  return {
    ...actual,
    // Add any specific mocks for core utilities if needed
  }
})

// Setup test environment
beforeEach(() => {
  vi.clearAllMocks()
})