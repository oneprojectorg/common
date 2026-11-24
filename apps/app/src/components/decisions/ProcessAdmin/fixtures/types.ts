import type { ProcessAdminPhase } from '../types';
import type { ProcessAdminFixtureName } from './names';

/** Sample phases the manage screens render while no phase query exists. */
export interface ProcessAdminFixture {
  name: ProcessAdminFixtureName;
  /** Stands in for `isProcessOpen`, which the fixture cannot compute from the real instance. */
  isOpen: boolean;
  phases: ProcessAdminPhase[];
}
