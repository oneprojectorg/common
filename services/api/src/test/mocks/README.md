# Shared module mocks

`setupFiles` re-runs per test file, so with `isolate: false` an inline
`vi.mock` factory builds a new spy each time while the modules cached from the
first file keep the first one. Spies therefore live here, in ordinary modules
cached once per worker, and `setup.ts` only points `vi.mock` at them.

- Never re-mock these modules in a test file. It splits the spy the test sees
  from the one cached consumers call.
- A test that reads `mock.calls` must be `it.sequential`. A concurrent
  sibling's `beforeEach` runs `vi.clearAllMocks()` mid-test and erases the
  history; filtering by an owned id guards contamination, not erasure.
