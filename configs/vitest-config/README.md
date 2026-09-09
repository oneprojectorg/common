# `@op/vitest-config`

Shared vitest configuration. Currently just coverage, which exists to make
`fallow health` CRAP scores real rather than estimated.

## Usage

```ts
import { coverageConfig } from '@op/vitest-config/coverage';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: coverageConfig(),
  },
});
```

Coverage stays off until `--coverage` is passed, so `pnpm test` is unaffected.
Run the instrumented pass and refresh the merged report from the repo root:

```bash
pnpm test:coverage   # instrumented tests, then merge into coverage/
pnpm health:baseline # rewrite the committed baseline in configs/fallow/
```

`services/api` is the bulk of the suite and needs the isolated test Supabase on
port 55321 (`pnpm w:api test:supabase:start`).
