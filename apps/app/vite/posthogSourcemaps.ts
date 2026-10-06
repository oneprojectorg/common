import { spawn } from 'node:child_process';
import type { Plugin } from 'vite';

interface PosthogSourcemapsOptions {
  enabled: boolean;
  personalApiKey: string | undefined;
  envId: string | undefined;
  host: string;
  project: string;
  version: string | undefined;
}

/**
 * Injects PostHog chunk ids into the built bundles and uploads their
 * sourcemaps, so error tracking can symbolicate production stack traces.
 * Browser maps are deleted after upload: the client bundle is public, the
 * maps must not be.
 */
export const posthogSourcemaps = (
  options: PosthogSourcemapsOptions,
): Plugin => ({
  name: 'op:posthog-sourcemaps',
  apply: 'build',
  async closeBundle() {
    if (!options.enabled) {
      return;
    }

    const isClient = this.environment.name === 'client';
    const directory = this.environment.config.build.outDir;
    const env = {
      ...process.env,
      POSTHOG_CLI_TOKEN: options.personalApiKey,
      POSTHOG_CLI_ENV_ID: options.envId,
    };

    try {
      await runCli(['sourcemap', 'inject', '--directory', directory], env);
      await runCli(
        [
          '--host',
          options.host,
          'sourcemap',
          'upload',
          '--directory',
          directory,
          '--project',
          options.project,
          ...(options.version ? ['--version', options.version] : []),
          ...(isClient ? ['--delete-after'] : []),
        ],
        env,
      );
    } catch (error) {
      // A failed upload costs symbolicated stack traces, not the deploy.
      this.warn(`PostHog sourcemap upload failed: ${String(error)}`);
    }
  },
});

const runCli = (args: Array<string>, env: NodeJS.ProcessEnv) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('posthog-cli', args, { env, stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`posthog-cli ${args.join(' ')} exited ${code}`)),
    );
  });
