import { Alert, AlertDescription } from '@op/sense/Alert';
import { LuFlaskConical } from 'react-icons/lu';

import type { ProcessAdminFixtureName } from './fixtures/names';

/**
 * Marks a page whose rail shows sample phases, so nobody mistakes them for the
 * process's own. Development only, so the copy is untranslated on purpose.
 */
export function ProcessAdminFixtureNotice({
  name,
}: {
  name: ProcessAdminFixtureName;
}) {
  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <LuFlaskConical aria-hidden />
      <AlertDescription>
        Showing the {name} fixture. These phases are sample data, not this
        process&apos;s phases.
      </AlertDescription>
    </Alert>
  );
}
