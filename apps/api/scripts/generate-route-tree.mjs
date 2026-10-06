// Regenerates src/routeTree.gen.ts without a build: resolving the Vite config
// runs TanStack Start's route generator, the same one `vite dev` and
// `vite build` run.
import { resolveConfig } from 'vite';

await resolveConfig({ root: new URL('..', import.meta.url).pathname }, 'build');
