import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { OPSignupCodeEmail } from './OPSignupCodeEmail';

// The configs without a Send Email hook use the committed HTML, so the two
// must not drift. After a change: `pnpm w:emails test -- -u`.
describe('OPSignupCodeEmail', () => {
  it('matches the Supabase confirmation template', async () => {
    const html = await render(OPSignupCodeEmail(), { pretty: true });

    await expect(html).toMatchFileSnapshot(
      '../../../supabase/templates/confirm.html',
    );
  });
});
