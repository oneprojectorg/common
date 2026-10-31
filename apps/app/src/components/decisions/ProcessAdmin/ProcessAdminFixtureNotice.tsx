import { Alert, AlertDescription } from '@op/sense/Alert';
import { LuFlaskConical } from 'react-icons/lu';

import { getTranslations } from '@/lib/i18n';

import type { ProcessAdminFixtureName } from './fixtures/names';

/** Marks a page whose rail shows sample phases, so nobody mistakes them for the process's own. */
export async function ProcessAdminFixtureNotice({
  name,
}: {
  name: ProcessAdminFixtureName;
}) {
  const t = await getTranslations('decisions.processAdmin');

  return (
    <Alert variant="warning" className="rounded-none border-x-0 border-t-0">
      <LuFlaskConical aria-hidden />
      <AlertDescription>{t('fixtureNotice', { name })}</AlertDescription>
    </Alert>
  );
}
