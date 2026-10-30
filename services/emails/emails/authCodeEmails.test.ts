import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { OPEmailChangeCodeEmail } from './OPEmailChangeCodeEmail';
import { OPLoginCodeEmail } from './OPLoginCodeEmail';
import { OPSignupCodeEmail } from './OPSignupCodeEmail';

// The configs without a Send Email hook use the committed HTML, so the two
// must not drift. After a change: `pnpm w:emails exec vitest run -u`.
describe('auth code emails', () => {
  it.each([
    {
      name: 'OPLoginCodeEmail',
      Email: OPLoginCodeEmail,
      file: 'magiclink.html',
    },
    {
      name: 'OPSignupCodeEmail',
      Email: OPSignupCodeEmail,
      file: 'confirm.html',
    },
    {
      name: 'OPEmailChangeCodeEmail',
      Email: OPEmailChangeCodeEmail,
      file: 'email_change.html',
    },
  ])('$name matches supabase/templates/$file', async ({ Email, file }) => {
    const html = await render(Email(), { pretty: true });

    await expect(html).toMatchFileSnapshot(
      `../../../supabase/templates/${file}`,
    );
  });
});
