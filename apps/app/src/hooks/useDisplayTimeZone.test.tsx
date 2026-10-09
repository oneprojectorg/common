// @vitest-environment jsdom
import { DEADLINE_FORMAT } from '@/utils/formatting';
import { act, waitFor } from '@testing-library/react';
import { useFormatter } from 'next-intl';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n/provider';

import { useDisplayTimeZone } from './useDisplayTimeZone';

const INSTANT = '2026-07-06T04:00:00.000Z';

function Timestamp() {
  const format = useFormatter();
  const timeZone = useDisplayTimeZone();

  return (
    <span>
      {format.dateTime(new Date(INSTANT), { ...DEADLINE_FORMAT, timeZone })}
    </span>
  );
}

function App() {
  return (
    <I18nProvider locale="en" messages={{}}>
      <Timestamp />
    </I18nProvider>
  );
}

/** Makes the "browser" report a zone that differs from the pinned server one. */
function stubViewerTimeZone(timeZone: string) {
  const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...resolvedOptions.call(this), timeZone };
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useDisplayTimeZone', () => {
  it('hydrates against the server markup, then switches to the viewer zone', async () => {
    const serverHtml = renderToString(<App />);
    expect(serverHtml).toContain('Jul 6, 2026, 4:00 AM UTC');

    stubViewerTimeZone('America/Los_Angeles');
    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <App />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(container.textContent).toContain('Jul 5, 2026, 9:00 PM PDT');
    });
  });
});
