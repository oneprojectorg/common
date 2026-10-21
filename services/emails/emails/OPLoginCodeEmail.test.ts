import { render } from 'react-email';
import { describe, expect, it } from 'vitest';

import { OPLoginCodeEmail } from './OPLoginCodeEmail';

// GoTrue sends the committed HTML, not this component, so the two must not drift.
// After a change to the template or the shared layout: `pnpm w:emails test -- -u`.
describe('OPLoginCodeEmail', () => {
  it('matches the Supabase magic-link template', async () => {
    // Not pretty-printed: a wrap inside the Go action would put whitespace in the code.
    const html = await render(OPLoginCodeEmail());

    await expect(html).toMatchFileSnapshot(
      '../../../supabase/templates/magiclink.html',
    );
  });
});
