import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { OPEmailChangeCodeEmail } from './OPEmailChangeCodeEmail';

// The configs without a Send Email hook use the committed HTML, so the two
// must not drift. After a change: `pnpm w:emails test -- -u`.
describe('OPEmailChangeCodeEmail', () => {
  it('matches the Supabase email-change template', async () => {
    const html = await render(OPEmailChangeCodeEmail(), { pretty: true });

    await expect(html).toMatchFileSnapshot(
      '../../../supabase/templates/email_change.html',
    );
  });
});
