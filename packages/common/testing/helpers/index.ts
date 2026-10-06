/**
 * Setup-free test helpers.
 *
 * `@op/common/testing` re-exports these too, but that entry loads `setup.ts`,
 * whose `vi.mock` calls (notably `@op/events`) a project like
 * `services/workflows` deliberately skips. Import from here when your project
 * defines its own setup files: nothing in this graph registers a mock or
 * touches `setup.ts`.
 *
 * Only helpers that build their own clients belong here. The managers that
 * reuse `supabaseTestAdminClient` stay behind `@op/common/testing`, because
 * that client only exists under the shared setup.
 */
export { TestPhoneAuthDataManager } from './TestPhoneAuthDataManager';
