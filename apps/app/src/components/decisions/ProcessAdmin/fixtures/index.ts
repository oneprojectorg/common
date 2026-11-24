import { draftFixture } from './draft';
import { liveFixture } from './live';
import type { ProcessAdminFixtureName } from './names';
import type { ProcessAdminFixture } from './types';

export {
  PROCESS_ADMIN_FIXTURE_NAMES,
  type ProcessAdminFixtureName,
} from './names';
export { readFixtureName } from './readFixtureName';
export type { ProcessAdminFixture } from './types';

const FIXTURES: Record<ProcessAdminFixtureName, ProcessAdminFixture> = {
  draft: draftFixture,
  live: liveFixture,
};

export function getProcessAdminFixture(
  name: ProcessAdminFixtureName,
): ProcessAdminFixture {
  return FIXTURES[name];
}
